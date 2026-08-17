import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import * as moment from 'moment-timezone';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { CrmCheckInDto, CrmCheckOutDto } from './dto/crm-attendance.dto';
import { AttendanceStatus, isWeeklyOff } from '../../config/constants';
import { CrmOfficesService } from '../crm-offices/crm-offices.service';

const IST_TZ = 'Asia/Kolkata';

@Injectable()
export class CrmAttendanceService {
    constructor(
        private projectsUtilsService: ProjectsUtilsService,
        private crmOfficesService: CrmOfficesService,
    ) { }

    private getTodayDate(): string {
        return moment().tz(IST_TZ).format('YYYY-MM-DD');
    }

    // ─── Helpers ───────────────────────────────────────────────────────────
    private parseHHMM(timeStr: string, baseDateStr: string): moment.Moment {
        return moment.tz(`${baseDateStr} ${timeStr}`, 'YYYY-MM-DD HH:mm', IST_TZ);
    }

    private calcLateMinutes(checkInTime: Date, shift: any): number {
        const today = moment(checkInTime).tz(IST_TZ).format('YYYY-MM-DD');
        const shiftStart = this.parseHHMM(shift.startTime, today);
        const graceTime = shiftStart.clone().add(shift.graceMinutes, 'minutes');
        const mCheckIn = moment(checkInTime).tz(IST_TZ);
        if (mCheckIn.isAfter(graceTime)) {
            return Math.floor(mCheckIn.diff(shiftStart, 'minutes'));
        }
        return 0;
    }

    private calcBreakMinutes(breaks: Array<{ startTime: Date; endTime?: Date }>): number {
        return breaks.reduce((total, b) => {
            if (b.startTime && b.endTime) {
                return total + Math.floor((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000);
            }
            return total;
        }, 0);
    }

    // ─── Check-In ──────────────────────────────────────────────────────────
    async checkIn(userId: string, companyId: string, dto: CrmCheckInDto, ip?: string) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const CrmShiftModel = this.projectsUtilsService.getCrmShiftModel();

        const today = this.getTodayDate();

        // 1. Validate user active
        const user = await CrmUserModel.findById(userId);
        if (!user || !user.isActive) throw new BadRequestException('User is inactive');

        // 2. No duplicate attendance today
        const existing = await CrmAttendanceModel.findOne({ userId, date: today });
        if (existing) {
            if (existing.checkIn?.time) {
                throw new ConflictException('Already checked in today');
            }
            if (existing.status === AttendanceStatus.ON_LEAVE) {
                throw new BadRequestException('Cannot check in: You have an approved leave for today. Please cancel your leave first if you are working.');
            }
        }

        // 3. Validate geo-fence (unless WFH)
        let geoInfo: any = { distanceMeters: null, officeName: null };
        const geoResult = await this.crmOfficesService.validateLocation(
            { lat: dto.lat, lng: dto.lng, companyId },
            companyId,
        );

        if (!geoResult.valid && !dto.isWFH) {
            const distance = geoResult.matchedOffice?.distanceMeters;
            let distanceStr = '';
            if (distance !== undefined) {
                distanceStr = distance < 1000 ? `${distance}m ` : `${(distance / 1000).toFixed(1)}km `;
            }
            throw new BadRequestException(`Check-in failed: You are ${distanceStr}away from the office. Please be within the allowed radius.`);
        }

        geoInfo.distanceMeters = geoResult.matchedOffice?.distanceMeters ?? null;
        geoInfo.officeName = geoResult.matchedOffice?.name ?? null;

        // 4. Fetch shift
        const shift = user.shiftId
            ? await CrmShiftModel.findById(user.shiftId)
            : await CrmShiftModel.findOne({ companyId });

        // 5. Calculate lateMinutes and status
        const checkInTime = new Date();
        const lateMinutes = shift ? this.calcLateMinutes(checkInTime, shift) : 0;

        // 5.5 Validate selfie if not WFH
        if (!dto.isWFH && !dto.selfieUrl) {
            throw new BadRequestException('Selfie is required for office check-in');
        }
        
        let status: AttendanceStatus;
        if (dto.isWFH) {
            status = AttendanceStatus.WFH;
        } else if (existing?.status === AttendanceStatus.HALF_DAY) {
            // Preserve HALF_DAY status if it was set by leave approval
            status = AttendanceStatus.HALF_DAY;
        } else {
            status = lateMinutes > 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
        }

        // 6. Create or update attendance doc
        const attendanceData: any = {
            checkIn: {
                time: checkInTime,
                location: { type: 'Point', coordinates: [dto.lng, dto.lat] },
                ip: ip || '',
                deviceId: dto.deviceId || '',
                selfieUrl: dto.selfieUrl || '',
            },
            lateMinutes,
            status,
        };

        let attendance;
        if (existing) {
            existing.set(attendanceData);
            attendance = await existing.save();
        } else {
            attendance = await CrmAttendanceModel.create({
                companyId,
                userId,
                date: today,
                ...attendanceData,
            });
        }

        await this.logAudit('CHECK_IN', userId, attendance._id, 'attendance');

        return {
            message: 'Checked in successfully',
            data: attendance,
            distanceMeters: geoInfo.distanceMeters,
            officeName: geoInfo.officeName,
        };
    }

    // ─── Check-Out ────────────────────────────────────────────────────────
    async checkOut(userId: string, dto: CrmCheckOutDto) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const CrmShiftModel = this.projectsUtilsService.getCrmShiftModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();

        const today = this.getTodayDate();
        const attendance = await CrmAttendanceModel.findOne({ userId, date: today });

        if (!attendance) throw new NotFoundException('No attendance record found for today');
        if (!attendance.checkIn?.time) throw new BadRequestException('Cannot check out without check-in');
        if (attendance.checkOut?.time) throw new ConflictException('Already checked out today');

        const checkOutTime = new Date();
        const breakMinutes = this.calcBreakMinutes(attendance.breaks || []);
        const totalWorkMinutes = Math.max(
            0,
            Math.floor((checkOutTime.getTime() - new Date(attendance.checkIn.time).getTime()) / 60000) - breakMinutes,
        );

        // Fetch shift for thresholds
        const user = await CrmUserModel.findById(userId);
        const shift = user?.shiftId
            ? await CrmShiftModel.findById(user.shiftId)
            : await CrmShiftModel.findOne({ companyId: attendance.companyId });

        const workingMinutes = shift?.workingMinutes || 480;
        const halfDayThreshold = shift?.halfDayThresholdMinutes ?? workingMinutes / 2;
        const overtimeThreshold = shift?.overtimeThresholdMinutes ?? 0;
        const overtimeMinutes = Math.max(0, totalWorkMinutes - workingMinutes - overtimeThreshold);

        const mCheckOut = moment(checkOutTime).tz(IST_TZ);

        const checkOutData: any = {
            'checkOut.time': mCheckOut.toDate(),
            breakMinutes,
            totalWorkMinutes,
            overtimeMinutes,
        };

        if (dto.lat !== undefined && dto.lng !== undefined) {
            checkOutData['checkOut.location'] = {
                type: 'Point',
                coordinates: [dto.lng, dto.lat],
            };
        }

        // Determine final status using configurable half-day threshold
        if (attendance.status !== AttendanceStatus.LATE) {
            if (totalWorkMinutes < halfDayThreshold) {
                checkOutData.status = AttendanceStatus.HALF_DAY;
            }
        }

        const updated = await CrmAttendanceModel.findByIdAndUpdate(
            attendance._id,
            { $set: checkOutData },
            { new: true },
        );


        await this.logAudit('CHECK_OUT', userId, attendance._id, 'attendance');
        return { message: 'Checked out successfully', data: updated };
    }

    // ─── Break Start ──────────────────────────────────────────────────────
    async breakStart(userId: string) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const today = this.getTodayDate();
        const attendance = await CrmAttendanceModel.findOne({ userId, date: today });

        if (!attendance?.checkIn?.time) throw new BadRequestException('Must check in first');
        if (attendance.checkOut?.time) throw new BadRequestException('Already checked out');

        const activeBreak = (attendance.breaks || []).find((b: any) => !b.endTime);
        if (activeBreak) throw new ConflictException('A break is already active');

        attendance.breaks = [...(attendance.breaks || []), { startTime: new Date() }];
        await attendance.save();

        return { message: 'Break started', data: attendance };
    }

    // ─── Break End ────────────────────────────────────────────────────────
    async breakEnd(userId: string) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const today = this.getTodayDate();
        const attendance = await CrmAttendanceModel.findOne({ userId, date: today });

        if (!attendance?.checkIn?.time) throw new BadRequestException('No active attendance');

        const activeBreak = (attendance.breaks || []).find((b: any) => !b.endTime);
        if (!activeBreak) throw new BadRequestException('No active break found');

        activeBreak.endTime = new Date();
        const breakMinutes = this.calcBreakMinutes(attendance.breaks);
        attendance.breakMinutes = breakMinutes;

        await attendance.save();
        return { message: 'Break ended', data: attendance };
    }

    // ─── WFH Mark (Admin/HR/Manager) ─────────────────────────────────────
    async markWFH(targetUserId: string, companyId: string, adminId: string) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const today = this.getTodayDate();

        const existing = await CrmAttendanceModel.findOne({ userId: targetUserId, date: today });
        if (existing?.checkIn?.time) {
            throw new BadRequestException('Employee has already checked in today');
        }

        const attendance = existing
            ? await CrmAttendanceModel.findByIdAndUpdate(
                existing._id,
                { $set: { status: AttendanceStatus.WFH } },
                { new: true },
            )
            : await CrmAttendanceModel.create({
                companyId,
                userId: targetUserId,
                date: today,
                status: AttendanceStatus.WFH,
                totalWorkMinutes: 0,
            });

        await this.logAudit('WFH_MARKED', adminId, attendance._id, 'attendance');
        return { message: 'Employee marked as WFH for today', data: attendance };
    }

    // ─── Today's Attendance ───────────────────────────────────────────────
    async getToday(userId: string) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const today = this.getTodayDate();
        const attendance: any = await CrmAttendanceModel.findOne({ userId, date: today }).lean();

        if (attendance && attendance.checkIn?.time) {
            const now = new Date();
            const checkInTime = new Date(attendance.checkIn.time);
            const endTime = attendance.checkOut?.time ? new Date(attendance.checkOut.time) : now;

            const liveBreakMinutes = (attendance.breaks || []).reduce((total, b) => {
                const start = new Date(b.startTime).getTime();
                const end = b.endTime ? new Date(b.endTime).getTime() : now.getTime();
                return total + Math.floor((end - start) / 60000);
            }, 0);

            const liveTotalWorkMinutes = Math.max(
                0,
                Math.floor((endTime.getTime() - checkInTime.getTime()) / 60000) - liveBreakMinutes,
            );

            return {
                data: {
                    ...attendance,
                    totalWorkMinutes: liveTotalWorkMinutes,
                    breakMinutes: liveBreakMinutes,
                },
            };
        }

        return { data: attendance || null };
    }

    // ─── History ──────────────────────────────────────────────────────────
    async getHistory(userId: string, page = 1, limit = 30, startDate?: string, endDate?: string) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const query: any = { userId };

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = startDate;
            if (endDate) query.date.$lte = endDate;
        }

        const skip = (page - 1) * limit;
        const [records, total] = await Promise.all([
            CrmAttendanceModel.find(query).sort({ date: -1 }).skip(skip).limit(limit).lean(),
            CrmAttendanceModel.countDocuments(query),
        ]);

        return {
            data: records,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    }

    // ─── Admin: All attendance ────────────────────────────────────────────
    async getAll(companyId: string, date?: string, department?: string, page = 1, limit = 50) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();

        const query: any = { companyId };
        if (date) query.date = date;

        // If department filter, get user IDs in that department
        if (department) {
            const users = await CrmUserModel.find({ companyId, department }).select('_id').lean();
            query.userId = { $in: users.map((u: any) => u._id) };
        }

        const skip = (page - 1) * limit;
        const [records, total] = await Promise.all([
            CrmAttendanceModel.find(query)
                .populate('userId', 'name email department role')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CrmAttendanceModel.countDocuments(query),
        ]);

        const today = this.getTodayDate();
        const now = new Date();

        const enrichedRecords = (records as any[]).map((r) => {
            if (r.date === today && r.checkIn?.time && !r.checkOut?.time) {
                const checkInTime = new Date(r.checkIn.time);
                const liveBreakMinutes = (r.breaks || []).reduce((totalBreak, b) => {
                    const start = new Date(b.startTime).getTime();
                    const end = b.endTime ? new Date(b.endTime).getTime() : now.getTime();
                    return totalBreak + Math.floor((end - start) / 60000);
                }, 0);
                const liveTotalWorkMinutes = Math.max(
                    0,
                    Math.floor((now.getTime() - checkInTime.getTime()) / 60000) - liveBreakMinutes,
                );
                return { ...r, totalWorkMinutes: liveTotalWorkMinutes, breakMinutes: liveBreakMinutes };
            }
            return r;
        });

        return {
            data: enrichedRecords,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    }

    // ─── Attendance Report ────────────────────────────────────────────────
    async getReport(userId: string, companyId: string, startDate: string, endDate: string) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const CrmHolidayModel = this.projectsUtilsService.getCrmHolidayModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();

        const user = await CrmUserModel.findById(userId).select('leaveBalance').lean();

        // Get all attendance records in range
        const records = await CrmAttendanceModel.find({
            userId,
            date: { $gte: startDate, $lte: endDate },
        }).lean();

        // Get holidays in range for working-day count
        const holidays = await CrmHolidayModel.find({
            companyId,
            date: { $gte: startDate, $lte: endDate },
            isActive: true,
        }).lean();
        const holidaySet = new Set(holidays.map((h: any) => h.date));

        // Count total working days in the date range
        let totalWorkingDays = 0;
        const current = new Date(startDate);
        const end = new Date(endDate);
        while (current <= end) {
            const dateStr = current.toISOString().split('T')[0];
            if (!isWeeklyOff(current) && !holidaySet.has(dateStr)) {
                totalWorkingDays++;
            }
            current.setDate(current.getDate() + 1);
        }

        // Aggregate from attendance records
        let presentDays = 0;
        let lateDays = 0;
        let absentDays = 0;
        let onLeaveDays = 0;
        let halfDays = 0;
        let wfhDays = 0;

        for (const r of records) {
            switch (r.status) {
                case AttendanceStatus.PRESENT: presentDays++; break;
                case AttendanceStatus.LATE: lateDays++; break;
                case AttendanceStatus.ABSENT: absentDays++; break;
                case AttendanceStatus.ON_LEAVE: onLeaveDays++; break;
                case AttendanceStatus.HALF_DAY: halfDays++; break;
                case AttendanceStatus.WFH: wfhDays++; break;
            }
        }

        return {
            data: {
                period: { startDate, endDate },
                totalWorkingDays,
                presentDays,       // PRESENT (on time)
                lateDays,          // LATE (after grace period)
                absentDays,        // ABSENT (no attendance)
                onLeaveDays,       // ON_LEAVE (approved leave)
                halfDays,          // HALF_DAY
                wfhDays,           // WFH
                totalPresent: presentDays + lateDays + wfhDays + halfDays, // Effective working days
                paidLeaveBalance: (user as any)?.leaveBalance?.total ?? 0,
            },
        };
    }

    // ─── Admin: Manual status override ───────────────────────────────────
    async updateStatus(id: string, status: AttendanceStatus, adminId: string) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const attendance = await CrmAttendanceModel.findByIdAndUpdate(
            id,
            { status },
            { new: true },
        );
        if (!attendance) throw new NotFoundException('Attendance record not found');

        await this.logAudit('ATTENDANCE_STATUS_UPDATED', adminId, attendance._id, 'attendance');
        return { message: 'Status updated', data: attendance };
    }

    async updateAttendance(id: string, dto: any, adminId: string) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const CrmShiftModel = this.projectsUtilsService.getCrmShiftModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();

        const attendance = await CrmAttendanceModel.findById(id);
        if (!attendance) throw new NotFoundException('Attendance record not found');

        const updateData: any = {};
        if (dto.status) updateData.status = dto.status;

        // If times are provided, recalculate stats
        if (dto.checkInTime || dto.checkOutTime) {
            const user = await CrmUserModel.findById(attendance.userId);
            const shift = user?.shiftId
                ? await CrmShiftModel.findById(user.shiftId)
                : await CrmShiftModel.findOne({ companyId: attendance.companyId });

            if (dto.checkInTime) {
                attendance.checkIn = attendance.checkIn || {};
                attendance.checkIn.time = new Date(dto.checkInTime);
                if (dto.selfieUrl !== undefined) {
                    attendance.checkIn.selfieUrl = dto.selfieUrl;
                }
                if (shift) {
                    attendance.lateMinutes = this.calcLateMinutes(attendance.checkIn.time, shift);
                    if (attendance.lateMinutes > 0 && attendance.status === AttendanceStatus.PRESENT) {
                        attendance.status = AttendanceStatus.LATE;
                    }
                }
            }

            if (dto.checkOutTime) {
                attendance.checkOut = attendance.checkOut || {};
                attendance.checkOut.time = new Date(dto.checkOutTime);
            }

            if (attendance.checkIn?.time && attendance.checkOut?.time) {
                const breakMinutes = this.calcBreakMinutes(attendance.breaks || []);
                const totalWorkMinutes = Math.max(
                    0,
                    Math.floor((new Date(attendance.checkOut.time).getTime() - new Date(attendance.checkIn.time).getTime()) / 60000) - breakMinutes,
                );

                const workingMinutes = shift?.workingMinutes || 480;
                const overtimeThreshold = shift?.overtimeThresholdMinutes ?? 0;
                const overtimeMinutes = Math.max(0, totalWorkMinutes - workingMinutes - overtimeThreshold);

                attendance.totalWorkMinutes = totalWorkMinutes;
                attendance.overtimeMinutes = overtimeMinutes;
                attendance.breakMinutes = breakMinutes;
            }
        }

        Object.assign(attendance, updateData);
        const updated = await attendance.save();

        await this.logAudit('ATTENDANCE_UPDATED_BY_ADMIN', adminId, attendance._id, 'attendance');
        return { message: 'Attendance updated successfully', data: updated };
    }

    // ─── Audit Helper ─────────────────────────────────────────────────────
    private async logAudit(action: string, userId: string, targetId: any, module: string) {
        try {
            const CrmAuditModel = this.projectsUtilsService.getCrmAuditLogModel();
            await CrmAuditModel.create({ action, performedBy: userId, targetId, module });
        } catch (_) { }
    }
}

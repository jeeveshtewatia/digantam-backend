import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as moment from 'moment-timezone';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { CreateCrmLeaveDto } from './dto/crm-leave.dto';
import { LeaveStatus, LeaveType, isWeeklyOff } from '../../config/constants';
import { AttendanceStatus } from '../../config/constants';

const IST_TZ = 'Asia/Kolkata';

@Injectable()
export class CrmLeavesService {
    constructor(private projectsUtilsService: ProjectsUtilsService) { }

    /**
     * Count working days between startDate and endDate (inclusive),
     * skipping: Sundays, 2nd/4th Saturdays, and company holidays
     */
    private async calcWorkingDays(
        startDate: string,
        endDate: string,
        companyId: string,
    ): Promise<number> {
        const CrmHolidayModel = this.projectsUtilsService.getCrmHolidayModel();
        const holidays = await CrmHolidayModel.find({
            companyId,
            date: { $gte: startDate, $lte: endDate },
            isActive: true,
        }).lean();
        const holidaySet = new Set(holidays.map((h: any) => h.date));

        let count = 0;
        const current = new Date(startDate + 'T00:00:00+05:30');
        const end = new Date(endDate + 'T00:00:00+05:30');
        while (current <= end) {
            const dateStr = moment(current).tz(IST_TZ).format('YYYY-MM-DD');
            if (!isWeeklyOff(current) && !holidaySet.has(dateStr)) {
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        return count;
    }

    /**
     * Helper: Returns an array of YYYY-MM-DD working days between two dates (IST)
     */
    private getWorkingDatesInRange(startDate: Date, endDate: Date): string[] {
        const dates: string[] = [];
        const current = new Date(startDate);
        while (current <= endDate) {
            if (!isWeeklyOff(current)) {
                dates.push(moment(current).tz(IST_TZ).format('YYYY-MM-DD'));
            }
            current.setDate(current.getDate() + 1);
        }
        return dates;
    }

    // ─── Apply For Leave ─────────────────────────────────────────────────────
    async apply(userId: string, companyId: string, dto: CreateCrmLeaveDto) {
        const CrmLeaveModel = this.projectsUtilsService.getCrmLeaveModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();

        const user = await CrmUserModel.findById(userId);
        if (!user) throw new NotFoundException('User not found');

        // For half-day
        let totalDays: number;
        if (dto.isHalfDay) {
            totalDays = 0.5;
            if (dto.startDate !== dto.endDate) {
                throw new BadRequestException('For half-day leave, startDate and endDate must be the same');
            }
            const start = new Date(dto.startDate + 'T00:00:00+05:30');
            if (isWeeklyOff(start)) {
                throw new BadRequestException('Cannot apply half-day leave on a weekly off day');
            }
            const CrmHolidayModel = this.projectsUtilsService.getCrmHolidayModel();
            const holiday = await CrmHolidayModel.findOne({ companyId, date: dto.startDate, isActive: true });
            if (holiday) throw new BadRequestException('Cannot apply leave on a holiday');
        } else {
            totalDays = await this.calcWorkingDays(dto.startDate, dto.endDate, companyId);
            if (totalDays <= 0) throw new BadRequestException('No working days in the selected range');
        }

        // No balance check block — all leaves are allowed; warn if some will be unpaid.
        const availableBalance = user.leaveBalance?.total ?? 0;
        const yearlyQuota = user.leaveBalance?.yearlyQuota ?? 24;
        const yearlyUsed = user.leaveBalance?.yearlyUsed ?? 0;
        const yearlyRemaining = yearlyQuota - yearlyUsed;

        const wouldBePaidDays = Math.min(totalDays, availableBalance);
        const wouldBeUnpaidDays = totalDays - wouldBePaidDays;

        const initialStatus = dto.status || LeaveStatus.PENDING;

        // If admin-approved immediately, handle inline
        let paidDays = 0;
        let unpaidDays = 0;
        if (initialStatus === LeaveStatus.APPROVED) {
            paidDays = Math.min(totalDays, availableBalance);
            unpaidDays = totalDays - paidDays;
            if (paidDays > 0) {
                await CrmUserModel.findByIdAndUpdate(userId, {
                    $inc: {
                        'leaveBalance.total': -paidDays,
                        'leaveBalance.yearlyUsed': paidDays,
                    },
                });
            }
        }

        const leave = await CrmLeaveModel.create({
            companyId,
            userId,
            type: dto.type || LeaveType.LEAVE,
            startDate: new Date(dto.startDate),
            endDate: new Date(dto.endDate),
            totalDays,
            paidDays,
            unpaidDays,
            isHalfDay: dto.isHalfDay ?? false,
            halfDayPeriod: dto.isHalfDay ? (dto.halfDayPeriod || 'morning') : undefined,
            reason: dto.reason,
            status: initialStatus,
        });

        return {
            message: 'Leave request created successfully',
            data: leave,
            leaveInfo: {
                totalDaysRequested: totalDays,
                estimatedPaidDays: wouldBePaidDays,
                estimatedUnpaidDays: wouldBeUnpaidDays,
                currentPaidBalance: availableBalance,
                yearlyQuota,
                yearlyUsed,
                yearlyRemaining,
                warning: wouldBeUnpaidDays > 0
                    ? `${wouldBeUnpaidDays} day(s) will be treated as unpaid leave`
                    : null,
            },
        };
    }

    // ─── List All Leaves (Admin) ──────────────────────────────────────────────
    async findAll(companyId: string, userId?: string, status?: LeaveStatus, page = 1, limit = 20) {
        const CrmLeaveModel = this.projectsUtilsService.getCrmLeaveModel();
        const query: any = { companyId };
        if (userId) query.userId = userId;
        if (status) query.status = status;

        const skip = (page - 1) * limit;
        const [leaves, total] = await Promise.all([
            CrmLeaveModel.find(query)
                .populate('userId', 'name email department')
                .populate('approvedBy', 'name email')
                .populate('cancelledBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CrmLeaveModel.countDocuments(query),
        ]);

        return {
            data: leaves,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    }

    // ─── My Leaves ────────────────────────────────────────────────────────────
    async findMyLeaves(userId: string, page = 1, limit = 20) {
        const CrmLeaveModel = this.projectsUtilsService.getCrmLeaveModel();
        const query = { userId };
        const skip = (page - 1) * limit;

        const [leaves, total] = await Promise.all([
            CrmLeaveModel.find(query)
                .populate('approvedBy', 'name email')
                .populate('cancelledBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CrmLeaveModel.countDocuments(query),
        ]);

        return {
            data: leaves,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    }

    // ─── Leave Summary ────────────────────────────────────────────────────────
    async leaveSummary(userId: string) {
        const CrmLeaveModel = this.projectsUtilsService.getCrmLeaveModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();

        const user = await CrmUserModel.findById(userId).select('leaveBalance').lean();
        if (!user) throw new NotFoundException('User not found');

        const lb = (user as any).leaveBalance ?? {};
        const currentYear = moment().tz(IST_TZ).year();
        const yearStart = `${currentYear}-01-01`;
        const yearEnd = `${currentYear}-12-31`;

        // Fetch all approved leaves this year
        const approvedLeaves = await CrmLeaveModel.find({
            userId,
            status: LeaveStatus.APPROVED,
            startDate: { $gte: new Date(yearStart), $lte: new Date(yearEnd) },
        }).lean();

        let totalLeavesTaken = 0;
        let totalPaidLeavesTaken = 0;
        let totalUnpaidLeavesTaken = 0;

        for (const l of approvedLeaves) {
            totalLeavesTaken += l.totalDays;
            totalPaidLeavesTaken += l.paidDays ?? 0;
            totalUnpaidLeavesTaken += l.unpaidDays ?? 0;
        }

        return {
            data: {
                yearlyQuota: lb.yearlyQuota ?? 24,              // Total paid leaves allowed this year
                yearlyUsed: lb.yearlyUsed ?? 0,                  // Paid leaves consumed this year
                yearlyRemaining: (lb.yearlyQuota ?? 24) - (lb.yearlyUsed ?? 0), // Remaining yearly balance
                currentPaidBalance: lb.total ?? 0,              // Current monthly paid leave pocket (max 6)
                totalLeavesTaken,                               // All leaves (paid + unpaid) this year
                totalPaidLeavesTaken,                           // Paid leave days consumed
                totalUnpaidLeavesTaken,                         // Unpaid leave days (salary deduction)
            },
        };
    }

    // ─── Approve ─────────────────────────────────────────────────────────────
    async approve(leaveId: string, approverId: string) {
        const CrmLeaveModel = this.projectsUtilsService.getCrmLeaveModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const AuditModel = this.projectsUtilsService.getCrmAuditLogModel();

        const leave = await CrmLeaveModel.findById(leaveId);
        if (!leave) throw new NotFoundException('Leave request not found');
        if (leave.status !== LeaveStatus.PENDING) {
            throw new BadRequestException(`Leave is already ${leave.status}`);
        }

        // Fetch current user balance
        const user = await CrmUserModel.findById(leave.userId).select('leaveBalance').lean();
        const availableBalance = (user as any)?.leaveBalance?.total ?? 0;

        // ── Core Logic: Split into paid / unpaid ─────────────────────────────
        const paidDays = Math.min(leave.totalDays, availableBalance);
        const unpaidDays = leave.totalDays - paidDays;

        // Deduct only the paid portion from balance and update yearlyUsed
        if (paidDays > 0) {
            await CrmUserModel.findByIdAndUpdate(leave.userId, {
                $inc: {
                    'leaveBalance.total': -paidDays,
                    'leaveBalance.yearlyUsed': paidDays,
                },
            });
        }

        // Save paid/unpaid breakdown on the leave record
        leave.paidDays = paidDays;
        leave.unpaidDays = unpaidDays;

        // ── FIX: Create/Update attendance records for each leave day ─────────
        if (leave.isHalfDay) {
            // FIX: Half-day leaves now create attendance records
            const dateStr = moment(leave.startDate).tz(IST_TZ).format('YYYY-MM-DD');
            try {
                await CrmAttendanceModel.findOneAndUpdate(
                    { userId: leave.userId, date: dateStr },
                    {
                        $setOnInsert: {
                            companyId: leave.companyId,
                            userId: leave.userId,
                            date: dateStr,
                            totalWorkMinutes: 0,
                        },
                        $set: { status: AttendanceStatus.HALF_DAY },  // Always set status
                    },
                    { upsert: true, new: true },
                );
            } catch (_) { /* duplicate key is fine, record already exists */ }
        } else {
            const workingDates = this.getWorkingDatesInRange(
                new Date(leave.startDate),
                new Date(leave.endDate),
            );

            for (const dateStr of workingDates) {
                try {
                    // FIX: Use $set for status so it overwrites existing PRESENT/LATE records
                    // (priority: approved leave > manual check-in status)
                    await CrmAttendanceModel.findOneAndUpdate(
                        { userId: leave.userId, date: dateStr },
                        {
                            $setOnInsert: {
                                companyId: leave.companyId,
                                userId: leave.userId,
                                date: dateStr,
                                totalWorkMinutes: 0,
                            },
                            $set: { status: AttendanceStatus.ON_LEAVE },  // Always overwrite status
                        },
                        { upsert: true, new: true },
                    );
                } catch (_) { /* duplicate key race conditions are safe to ignore */ }
            }
        }

        leave.status = LeaveStatus.APPROVED;
        leave.approvedBy = approverId as any;
        await leave.save();

        try {
            await AuditModel.create({
                action: 'LEAVE_APPROVED',
                performedBy: approverId,
                targetId: leave._id,
                module: 'leaves',
            });
        } catch (_) { }

        return {
            message: 'Leave approved successfully',
            data: leave,
            breakdown: {
                totalDays: leave.totalDays,
                paidDays,
                unpaidDays,
                note: unpaidDays > 0
                    ? `${unpaidDays} day(s) will be unpaid (salary deduction)`
                    : 'All days covered by paid balance',
            },
        };
    }

    // ─── Reject ───────────────────────────────────────────────────────────────
    async reject(leaveId: string, approverId: string) {
        const CrmLeaveModel = this.projectsUtilsService.getCrmLeaveModel();
        const AuditModel = this.projectsUtilsService.getCrmAuditLogModel();

        const leave = await CrmLeaveModel.findById(leaveId);
        if (!leave) throw new NotFoundException('Leave request not found');
        if (leave.status !== LeaveStatus.PENDING) {
            throw new BadRequestException(`Leave is already ${leave.status}`);
        }

        leave.status = LeaveStatus.REJECTED;
        leave.approvedBy = approverId as any;
        await leave.save();

        try {
            await AuditModel.create({ action: 'LEAVE_REJECTED', performedBy: approverId, targetId: leave._id, module: 'leaves' });
        } catch (_) { }

        return { message: 'Leave rejected', data: leave };
    }

    // ─── Cancel ───────────────────────────────────────────────────────────────
    async cancel(leaveId: string, requesterId: string, isAdmin: boolean, cancelReason?: string) {
        const CrmLeaveModel = this.projectsUtilsService.getCrmLeaveModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const AuditModel = this.projectsUtilsService.getCrmAuditLogModel();

        const leave = await CrmLeaveModel.findById(leaveId);
        if (!leave) throw new NotFoundException('Leave request not found');

        if (!isAdmin && leave.userId.toString() !== requesterId) {
            throw new ForbiddenException('You can only cancel your own leave');
        }
        if (leave.status === LeaveStatus.CANCELLED) {
            throw new BadRequestException('Leave is already cancelled');
        }
        if (leave.status === LeaveStatus.REJECTED) {
            throw new BadRequestException('Cannot cancel a rejected leave');
        }

        const wasApproved = leave.status === LeaveStatus.APPROVED;

        // Restore ONLY the paid portion of the leave back to balance
        if (wasApproved && (leave.paidDays ?? 0) > 0) {
            await CrmUserModel.findByIdAndUpdate(leave.userId, {
                $inc: {
                    'leaveBalance.total': leave.paidDays,
                    'leaveBalance.yearlyUsed': -(leave.paidDays),
                },
            });
        }

        // FIX: Clean up ON_LEAVE attendance records for this approved leave
        if (wasApproved) {
            try {
                if (leave.isHalfDay) {
                    const dateStr = moment(leave.startDate).tz(IST_TZ).format('YYYY-MM-DD');
                    // For half-day: delete the HALF_DAY record completely
                    await CrmAttendanceModel.deleteOne({
                        userId: leave.userId,
                        date: dateStr,
                        status: AttendanceStatus.HALF_DAY,
                    });
                } else {
                    const workingDates = this.getWorkingDatesInRange(
                        new Date(leave.startDate),
                        new Date(leave.endDate),
                    );
                    // Delete all ON_LEAVE records for those dates
                    await CrmAttendanceModel.deleteMany({
                        userId: leave.userId,
                        date: { $in: workingDates },
                        status: AttendanceStatus.ON_LEAVE,
                    });
                }
            } catch (err) { /* non-critical: log but don't fail the cancel */ }
        }

        leave.status = LeaveStatus.CANCELLED;
        leave.cancelledBy = requesterId as any;
        leave.cancelledAt = new Date();
        leave.cancelReason = cancelReason || null;
        await leave.save();

        try {
            await AuditModel.create({ action: 'LEAVE_CANCELLED', performedBy: requesterId, targetId: leave._id, module: 'leaves' });
        } catch (_) { }

        return { message: 'Leave cancelled successfully', data: leave };
    }

    // ─── Admin Update Leave ───────────────────────────────────────────────────
    async updateLeave(leaveId: string, dto: any, adminId: string) {
        const CrmLeaveModel = this.projectsUtilsService.getCrmLeaveModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const AuditModel = this.projectsUtilsService.getCrmAuditLogModel();

        const leave = await CrmLeaveModel.findById(leaveId);
        if (!leave) throw new NotFoundException('Leave request not found');

        const oldStatus = leave.status;
        const oldPaidDays = leave.paidDays ?? 0;

        if (dto.startDate || dto.endDate) {
            const startDate = dto.startDate || moment(leave.startDate).tz(IST_TZ).format('YYYY-MM-DD');
            const endDate = dto.endDate || moment(leave.endDate).tz(IST_TZ).format('YYYY-MM-DD');
            leave.startDate = new Date(startDate);
            leave.endDate = new Date(endDate);
            leave.totalDays = await this.calcWorkingDays(startDate, endDate, leave.companyId);
        }

        if (dto.type) leave.type = dto.type;
        if (dto.status) leave.status = dto.status;
        if (dto.reason) leave.reason = dto.reason;

        // Re-calculate paid/unpaid if transitioning to APPROVED
        if (leave.status === LeaveStatus.APPROVED && oldStatus !== LeaveStatus.APPROVED) {
            const user = await CrmUserModel.findById(leave.userId).select('leaveBalance').lean();
            const availableBalance = (user as any)?.leaveBalance?.total ?? 0;
            const paidDays = Math.min(leave.totalDays, availableBalance);
            const unpaidDays = leave.totalDays - paidDays;
            leave.paidDays = paidDays;
            leave.unpaidDays = unpaidDays;
            if (paidDays > 0) {
                await CrmUserModel.findByIdAndUpdate(leave.userId, {
                    $inc: { 'leaveBalance.total': -paidDays, 'leaveBalance.yearlyUsed': paidDays },
                });
            }

            // Create attendance records for the newly approved leave
            if (!leave.isHalfDay) {
                const workingDates = this.getWorkingDatesInRange(new Date(leave.startDate), new Date(leave.endDate));
                for (const dateStr of workingDates) {
                    try {
                        await CrmAttendanceModel.findOneAndUpdate(
                            { userId: leave.userId, date: dateStr },
                            {
                                $setOnInsert: { companyId: leave.companyId, userId: leave.userId, date: dateStr, totalWorkMinutes: 0 },
                                $set: { status: AttendanceStatus.ON_LEAVE },
                            },
                            { upsert: true, new: true },
                        );
                    } catch (_) { }
                }
            } else {
                const dateStr = moment(leave.startDate).tz(IST_TZ).format('YYYY-MM-DD');
                try {
                    await CrmAttendanceModel.findOneAndUpdate(
                        { userId: leave.userId, date: dateStr },
                        {
                            $setOnInsert: { companyId: leave.companyId, userId: leave.userId, date: dateStr, totalWorkMinutes: 0 },
                            $set: { status: AttendanceStatus.HALF_DAY },
                        },
                        { upsert: true, new: true },
                    );
                } catch (_) { }
            }
        } else if (oldStatus === LeaveStatus.APPROVED && leave.status !== LeaveStatus.APPROVED) {
            // Restore old paid days
            if (oldPaidDays > 0) {
                await CrmUserModel.findByIdAndUpdate(leave.userId, {
                    $inc: { 'leaveBalance.total': oldPaidDays, 'leaveBalance.yearlyUsed': -oldPaidDays },
                });
            }
            leave.paidDays = 0;
            leave.unpaidDays = 0;

            // FIX: Clean up attendance records when unapproving
            try {
                const workingDates = this.getWorkingDatesInRange(new Date(leave.startDate), new Date(leave.endDate));
                await CrmAttendanceModel.deleteMany({
                    userId: leave.userId,
                    date: { $in: workingDates },
                    status: { $in: [AttendanceStatus.ON_LEAVE, AttendanceStatus.HALF_DAY] },
                });
            } catch (_) { }
        }

        const updated = await leave.save();

        try {
            await AuditModel.create({ action: 'LEAVE_UPDATED_BY_ADMIN', performedBy: adminId, targetId: leave._id, module: 'leaves' });
        } catch (_) { }

        return { message: 'Leave updated successfully', data: updated };
    }
}

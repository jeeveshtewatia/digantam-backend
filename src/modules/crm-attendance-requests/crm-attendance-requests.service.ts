import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as moment from 'moment-timezone';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import {
    CreateAttendanceEditRequestDto,
    ReviewAttendanceEditRequestDto,
} from './dto/crm-attendance-request.dto';

const IST_TZ = 'Asia/Kolkata';

@Injectable()
export class CrmAttendanceRequestsService {
    constructor(private projectsUtilsService: ProjectsUtilsService) { }

    async submit(userId: string, companyId: string, dto: CreateAttendanceEditRequestDto) {
        const RequestModel = this.projectsUtilsService.getCrmAttendanceEditRequestModel();

        if (!dto.requestedCheckIn && !dto.requestedCheckOut) {
            throw new BadRequestException('Provide at least one of requestedCheckIn or requestedCheckOut');
        }

        // Check for existing pending request for the same date
        const existing = await RequestModel.findOne({ userId, date: dto.date, status: 'PENDING' });
        if (existing) {
            throw new BadRequestException(`A pending edit request for ${dto.date} already exists`);
        }

        const request = await RequestModel.create({
            companyId,
            userId,
            date: dto.date,
            requestedCheckIn: dto.requestedCheckIn || null,
            requestedCheckOut: dto.requestedCheckOut || null,
            selfieUrl: dto.selfieUrl || null,
            reason: dto.reason,
        });

        return { message: 'Edit request submitted successfully', data: request };
    }

    async findAll(companyId: string, status?: string, page = 1, limit = 20) {
        const RequestModel = this.projectsUtilsService.getCrmAttendanceEditRequestModel();
        const query: any = { companyId };
        if (status) query.status = status;

        const skip = (page - 1) * limit;
        const [requests, total] = await Promise.all([
            RequestModel.find(query)
                .populate('userId', 'name email department')
                .populate('reviewedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            RequestModel.countDocuments(query),
        ]);

        return {
            data: requests,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    }

    async findMyRequests(userId: string, page = 1, limit = 20) {
        const RequestModel = this.projectsUtilsService.getCrmAttendanceEditRequestModel();
        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
            RequestModel.find({ userId })
                .populate('reviewedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            RequestModel.countDocuments({ userId }),
        ]);

        return {
            data: requests,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    }

    async approve(id: string, adminId: string, dto: ReviewAttendanceEditRequestDto) {
        const RequestModel = this.projectsUtilsService.getCrmAttendanceEditRequestModel();
        const AttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const AuditModel = this.projectsUtilsService.getCrmAuditLogModel();

        const request = await RequestModel.findById(id);
        if (!request) throw new NotFoundException('Edit request not found');
        if (request.status !== 'PENDING') {
            throw new BadRequestException(`Request is already ${request.status}`);
        }

        // Apply changes to attendance record
        const attendance = await AttendanceModel.findOne({ userId: request.userId, date: request.date });
        if (!attendance) {
            throw new NotFoundException(`No attendance record found for date ${request.date}`);
        }

        const updateData: any = {};
        if (request.requestedCheckIn) {
            const checkInMoment = moment.tz(`${request.date} ${request.requestedCheckIn}`, 'YYYY-MM-DD HH:mm', IST_TZ);
            updateData['checkIn.time'] = checkInMoment.toDate();
        }
        if (request.requestedCheckOut) {
            const checkOutMoment = moment.tz(`${request.date} ${request.requestedCheckOut}`, 'YYYY-MM-DD HH:mm', IST_TZ);
            updateData['checkOut.time'] = checkOutMoment.toDate();
        }
        if (request.selfieUrl) {
            updateData['checkIn.selfieUrl'] = request.selfieUrl;
        }

        if (Object.keys(updateData).length > 0) {
            // Recalculate work minutes if both times are present
            const attendanceDoc = attendance.toObject();
            const checkIn = updateData['checkIn.time'] || (attendanceDoc.checkIn?.time ? new Date(attendanceDoc.checkIn.time) : null);
            const checkOut = updateData['checkOut.time'] || (attendanceDoc.checkOut?.time ? new Date(attendanceDoc.checkOut.time) : null);

            if (checkIn && checkOut) {
                const totalWorkMinutes = Math.max(
                    0,
                    Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000) - (attendanceDoc.breakMinutes || 0),
                );
                updateData.totalWorkMinutes = totalWorkMinutes;
            }

            await AttendanceModel.findByIdAndUpdate(attendance._id, { $set: updateData });
        }

        // Update request status
        request.status = 'APPROVED';
        request.reviewedBy = adminId as any;
        request.reviewedAt = new Date();
        request.reviewNote = dto.reviewNote || null;
        await request.save();

        // Audit log
        try {
            await AuditModel.create({
                action: 'ATTENDANCE_EDIT_APPROVED',
                performedBy: adminId,
                targetId: attendance._id,
                module: 'attendance-requests',
            });
        } catch (_) { }

        return { message: 'Edit request approved and attendance updated', data: request };
    }

    async reject(id: string, adminId: string, dto: ReviewAttendanceEditRequestDto) {
        const RequestModel = this.projectsUtilsService.getCrmAttendanceEditRequestModel();
        const AuditModel = this.projectsUtilsService.getCrmAuditLogModel();

        const request = await RequestModel.findById(id);
        if (!request) throw new NotFoundException('Edit request not found');
        if (request.status !== 'PENDING') {
            throw new BadRequestException(`Request is already ${request.status}`);
        }

        request.status = 'REJECTED';
        request.reviewedBy = adminId as any;
        request.reviewedAt = new Date();
        request.reviewNote = dto.reviewNote || null;
        await request.save();

        try {
            await AuditModel.create({
                action: 'ATTENDANCE_EDIT_REJECTED',
                performedBy: adminId,
                targetId: request._id,
                module: 'attendance-requests',
            });
        } catch (_) { }

        return { message: 'Edit request rejected', data: request };
    }
}

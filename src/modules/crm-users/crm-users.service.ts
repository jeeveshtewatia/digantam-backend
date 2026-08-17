import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { UpdateCrmUserDto } from './dto/update-crm-user.dto';
import { CrmRole } from '../../config/constants';

@Injectable()
export class CrmUsersService {
    constructor(private projectsUtilsService: ProjectsUtilsService) { }

    async findAll(companyId: string, page = 1, limit = 20, search?: string, department?: string) {
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const skip = (page - 1) * limit;

        const query: any = { companyId };

        // Search by name or email
        if (search) {
            const regex = new RegExp(search, 'i');
            query.$or = [{ name: regex }, { email: regex }];
        }
        // Filter by department
        if (department) {
            query.department = department;
        }

        const [users, total] = await Promise.all([
            CrmUserModel.find(query)
                .select('-passwordHash')
                .populate('reportingManagerId', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CrmUserModel.countDocuments(query),
        ]);

        return {
            message: 'Users retrieved successfully',
            data: users,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    }

    async findById(id: string) {
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const user = await CrmUserModel.findById(id)
            .select('-passwordHash')
            .populate('reportingManagerId', 'name email');
        if (!user) throw new NotFoundException('CRM user not found');
        return user;
    }

    async update(id: string, dto: UpdateCrmUserDto, currentUser: any) {
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const AuditModel = this.projectsUtilsService.getCrmAuditLogModel();

        const user = await CrmUserModel.findById(id);
        if (!user) throw new NotFoundException('CRM user not found');

        // Only ADMIN can change roles
        if (dto.role && currentUser.role !== CrmRole.ADMIN) {
            throw new ForbiddenException('Only ADMIN can change user roles');
        }

        Object.assign(user, dto);
        await user.save();

        try {
            await AuditModel.create({
                action: 'USER_UPDATED',
                performedBy: currentUser._id,
                targetId: user._id,
                module: 'users',
            });
        } catch (_) { }

        const updated = user.toObject();
        delete updated.passwordHash;
        return { message: 'User updated successfully', data: updated };
    }

    async toggleStatus(id: string, isActive: boolean, currentUserId: string) {
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const AuditModel = this.projectsUtilsService.getCrmAuditLogModel();

        const user = await CrmUserModel.findByIdAndUpdate(
            id,
            { isActive },
            { new: true },
        ).select('-passwordHash');

        if (!user) throw new NotFoundException('CRM user not found');

        try {
            await AuditModel.create({
                action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
                performedBy: currentUserId,
                targetId: user._id,
                module: 'users',
            });
        } catch (_) { }

        return {
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: user,
        };
    }

    async getLeaveBalance(userId: string) {
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const user = await CrmUserModel.findById(userId).select('leaveBalance name email');
        if (!user) throw new NotFoundException('CRM user not found');
        return user;
    }

    async updateLeaveBalance(userId: string, total: number, adminId: string) {
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const user = await CrmUserModel.findByIdAndUpdate(
            userId,
            { 'leaveBalance.total': total },
            { new: true },
        ).select('leaveBalance name email');
        if (!user) throw new NotFoundException('CRM user not found');

        const AuditModel = this.projectsUtilsService.getCrmAuditLogModel();
        try {
            await AuditModel.create({
                action: 'LEAVE_BALANCE_ADJUSTED',
                performedBy: adminId,
                targetId: user._id,
                module: 'users',
            });
        } catch (_) { }

        return { message: 'Leave balance updated', data: user };
    }
}

import {
    Controller,
    Get, Post, Put, Delete,
    Body, Param, Query,
    UseGuards, Req,
    ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CrmLeavesService } from './crm-leaves.service';
import { CreateCrmLeaveDto, CancelCrmLeaveDto } from './dto/crm-leave.dto';
import { CrmRolesGuard } from '../../shared/guards/crm-roles.guard';
import { CrmRoles } from '../../shared/decorators/crm-roles.decorator';
import { CrmRole, LeaveStatus } from '../../config/constants';
import { Public } from '../../shared/decorators/public.decorator';

@ApiTags('CRM Leaves')
@Controller('crm/leaves')
@Public()
@UseGuards(AuthGuard('crm-jwt'), CrmRolesGuard)
@ApiBearerAuth('JWT-auth')
export class CrmLeavesController {
    constructor(private readonly crmLeavesService: CrmLeavesService) { }

    @Post()
    @ApiOperation({ summary: 'Apply for leave (full-day or half-day)' })
    async apply(@Body() dto: CreateCrmLeaveDto, @Req() req: any) {
        let targetUserId = req.crmUser._id.toString();

        if ((dto as any)['userId'] && (dto as any)['userId'] !== targetUserId) {
            const isAdmin = [CrmRole.ADMIN, CrmRole.HR].includes(req.crmUser.role);
            if (!isAdmin) throw new ForbiddenException('Only Admin/HR can apply for others');
            targetUserId = (dto as any)['userId'];
        }

        return this.crmLeavesService.apply(targetUserId, req.crmUser.companyId, dto);
    }

    @Get()
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR, CrmRole.MANAGER)
    @ApiOperation({ summary: 'List all employee leaves (Admin/HR/Manager)' })
    @ApiQuery({ name: 'status', enum: LeaveStatus, required: false })
    @ApiQuery({ name: 'userId', required: false })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    async findAll(
        @Req() req: any,
        @Query('status') status?: LeaveStatus,
        @Query('userId') userId?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ) {
        return this.crmLeavesService.findAll(req.crmUser.companyId, userId, status, +page, +limit);
    }

    @Get('mine')
    @ApiOperation({ summary: 'Get my leave requests' })
    @ApiQuery({ name: 'userId', required: false, description: 'Admin only — view another user' })
    async getMyLeaves(
        @Req() req: any,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
        @Query('userId') userId?: string,
    ) {
        let targetUserId = req.crmUser._id.toString();
        if (userId && userId !== targetUserId) {
            const isAdmin = [CrmRole.ADMIN, CrmRole.HR, CrmRole.MANAGER].includes(req.crmUser.role);
            if (!isAdmin) throw new ForbiddenException('Only Admin can see other users leaves');
            targetUserId = userId;
        }
        return this.crmLeavesService.findMyLeaves(targetUserId, +page, +limit);
    }

    @Get('summary')
    @ApiOperation({ summary: 'Get leave summary: yearly quota, paid/unpaid breakdown, current balance' })
    @ApiQuery({ name: 'userId', required: false, description: 'Admin/HR only — view another user' })
    async leaveSummary(
        @Req() req: any,
        @Query('userId') userId?: string,
    ) {
        let targetUserId = req.crmUser._id.toString();
        if (userId && userId !== targetUserId) {
            const isAdmin = [CrmRole.ADMIN, CrmRole.HR, CrmRole.MANAGER].includes(req.crmUser.role);
            if (!isAdmin) throw new ForbiddenException('You can only view your own summary');
            targetUserId = userId;
        }
        return this.crmLeavesService.leaveSummary(targetUserId);
    }

    @Put(':id/approve')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Approve a leave request (Admin/HR only)' })
    async approve(@Param('id') id: string, @Req() req: any) {
        return this.crmLeavesService.approve(id, req.crmUser._id.toString());
    }

    @Put(':id/reject')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Reject a leave request (Admin/HR only)' })
    async reject(@Param('id') id: string, @Req() req: any) {
        return this.crmLeavesService.reject(id, req.crmUser._id.toString());
    }

    @Delete(':id/cancel')
    @ApiOperation({ summary: 'Cancel a leave (employee cancels own; admin can cancel any)' })
    async cancel(@Param('id') id: string, @Body() dto: CancelCrmLeaveDto, @Req() req: any) {
        const isAdmin = [CrmRole.ADMIN, CrmRole.HR].includes(req.crmUser.role);
        return this.crmLeavesService.cancel(
            id,
            req.crmUser._id.toString(),
            isAdmin,
            dto.cancelReason,
        );
    }

    @Put(':id')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Update a leave request (Admin/HR only)' })
    async update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
        return this.crmLeavesService.updateLeave(id, dto, req.crmUser._id.toString());
    }
}

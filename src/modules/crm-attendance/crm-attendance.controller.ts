import {
    Controller,
    Get, Post, Put,
    Body, Param, Query,
    UseGuards, Req,
    ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CrmAttendanceService } from './crm-attendance.service';
import { CrmCheckInDto, CrmCheckOutDto } from './dto/crm-attendance.dto';
import { CrmRolesGuard } from '../../shared/guards/crm-roles.guard';
import { CrmRoles } from '../../shared/decorators/crm-roles.decorator';
import { CrmRole, AttendanceStatus } from '../../config/constants';
import { Public } from '../../shared/decorators/public.decorator';
import { IsMongoId, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class MarkWFHDto {
    @ApiProperty({ description: 'Employee user ID to mark as WFH' })
    @IsMongoId()
    @IsNotEmpty()
    userId: string;
}

@ApiTags('CRM Attendance')
@Controller('crm/attendance')
@Public()
@UseGuards(AuthGuard('crm-jwt'))
@ApiBearerAuth('JWT-auth')
export class CrmAttendanceController {
    constructor(private readonly crmAttendanceService: CrmAttendanceService) { }

    @Post('check-in')
    @ApiOperation({ summary: 'Employee check-in with geo-fence validation' })
    async checkIn(@Body() dto: CrmCheckInDto, @Req() req: any) {
        const ip = req.ip || req.headers['x-forwarded-for'];
        return this.crmAttendanceService.checkIn(
            req.crmUser._id.toString(),
            req.crmUser.companyId,
            dto,
            ip,
        );
    }

    @Post('check-out')
    @ApiOperation({ summary: 'Employee check-out' })
    async checkOut(@Body() dto: CrmCheckOutDto, @Req() req: any) {
        return this.crmAttendanceService.checkOut(req.crmUser._id.toString(), dto);
    }

    @Post('break/start')
    @ApiOperation({ summary: 'Start a break' })
    async breakStart(@Req() req: any) {
        return this.crmAttendanceService.breakStart(req.crmUser._id.toString());
    }

    @Post('break/end')
    @ApiOperation({ summary: 'End the current break' })
    async breakEnd(@Req() req: any) {
        return this.crmAttendanceService.breakEnd(req.crmUser._id.toString());
    }

    @Post('wfh')
    @UseGuards(CrmRolesGuard)
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR, CrmRole.MANAGER)
    @ApiOperation({ summary: 'Mark employee as WFH for today (Admin/HR/Manager)' })
    async markWFH(@Body() dto: MarkWFHDto, @Req() req: any) {
        return this.crmAttendanceService.markWFH(
            dto.userId,
            req.crmUser.companyId,
            req.crmUser._id.toString(),
        );
    }

    @Get('today')
    @ApiOperation({ summary: "Get today's attendance record" })
    async getToday(@Req() req: any) {
        return this.crmAttendanceService.getToday(req.crmUser._id.toString());
    }

    @Get('history')
    @ApiOperation({ summary: 'Get attendance history (with pagination)' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
    @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
    @ApiQuery({ name: 'userId', required: false, description: 'Filter by user (Admin only)' })
    async getHistory(
        @Req() req: any,
        @Query('page') page = 1,
        @Query('limit') limit = 30,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('userId') userId?: string,
    ) {
        let targetUserId = req.crmUser._id.toString();
        if (userId && userId !== targetUserId) {
            const hasPrivilege = [CrmRole.ADMIN, CrmRole.HR, CrmRole.MANAGER].includes(req.crmUser.role);
            if (!hasPrivilege) throw new ForbiddenException('You can only view your own history');
            targetUserId = userId;
        }
        return this.crmAttendanceService.getHistory(targetUserId, +page, +limit, startDate, endDate);
    }

    @Get('report')
    @ApiOperation({ summary: 'Get attendance report: working days, present, absent, on-leave' })
    @ApiQuery({ name: 'startDate', required: true, description: 'YYYY-MM-DD' })
    @ApiQuery({ name: 'endDate', required: true, description: 'YYYY-MM-DD' })
    @ApiQuery({ name: 'userId', required: false, description: 'Target user ID (Admin/HR only, defaults to self)' })
    async getReport(
        @Req() req: any,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('userId') userId?: string,
    ) {
        let targetUserId = req.crmUser._id.toString();
        if (userId && userId !== targetUserId) {
            const hasPrivilege = [CrmRole.ADMIN, CrmRole.HR, CrmRole.MANAGER].includes(req.crmUser.role);
            if (!hasPrivilege) throw new ForbiddenException('You can only view your own report');
            targetUserId = userId;
        }
        return this.crmAttendanceService.getReport(targetUserId, req.crmUser.companyId, startDate, endDate);
    }

    @Get('admin')
    @UseGuards(CrmRolesGuard)
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR, CrmRole.MANAGER)
    @ApiOperation({ summary: "Admin view: all employees' attendance" })
    @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD filter' })
    @ApiQuery({ name: 'department', required: false, description: 'Filter by department name' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    async getAll(
        @Req() req: any,
        @Query('date') date?: string,
        @Query('department') department?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 50,
    ) {
        return this.crmAttendanceService.getAll(req.crmUser.companyId, date, department, +page, +limit);
    }

    @Put(':id/status')
    @UseGuards(CrmRolesGuard)
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Manual status override (Admin/HR only)' })
    async updateStatus(
        @Param('id') id: string,
        @Body('status') status: AttendanceStatus,
        @Req() req: any,
    ) {
        return this.crmAttendanceService.updateStatus(id, status, req.crmUser._id.toString());
    }

    @Put(':id')
    @UseGuards(CrmRolesGuard)
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Update attendance record (Admin/HR only)' })
    async updateAttendance(
        @Param('id') id: string,
        @Body() dto: any,
        @Req() req: any,
    ) {
        return this.crmAttendanceService.updateAttendance(id, dto, req.crmUser._id.toString());
    }
}

import {
    Controller, Get, Post, Put,
    Body, Param, Query,
    UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CrmAttendanceRequestsService } from './crm-attendance-requests.service';
import { CreateAttendanceEditRequestDto, ReviewAttendanceEditRequestDto } from './dto/crm-attendance-request.dto';
import { CrmRolesGuard } from '../../shared/guards/crm-roles.guard';
import { CrmRoles } from '../../shared/decorators/crm-roles.decorator';
import { CrmRole } from '../../config/constants';
import { Public } from '../../shared/decorators/public.decorator';

@ApiTags('CRM Attendance Requests')
@Controller('crm/attendance-requests')
@Public()
@UseGuards(AuthGuard('crm-jwt'), CrmRolesGuard)
@ApiBearerAuth('JWT-auth')
export class CrmAttendanceRequestsController {
    constructor(private readonly service: CrmAttendanceRequestsService) { }

    @Post()
    @ApiOperation({ summary: 'Submit attendance edit request (Employee)' })
    async submit(@Body() dto: CreateAttendanceEditRequestDto, @Req() req: any) {
        return this.service.submit(
            req.crmUser._id.toString(),
            req.crmUser.companyId,
            dto,
        );
    }

    @Get()
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR, CrmRole.MANAGER)
    @ApiOperation({ summary: 'List all attendance edit requests (Admin/HR/Manager)' })
    @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    async findAll(
        @Req() req: any,
        @Query('status') status?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ) {
        return this.service.findAll(req.crmUser.companyId, status, +page, +limit);
    }

    @Get('mine')
    @ApiOperation({ summary: 'Get my attendance edit requests' })
    async findMine(@Req() req: any, @Query('page') page = 1, @Query('limit') limit = 20) {
        return this.service.findMyRequests(req.crmUser._id.toString(), +page, +limit);
    }

    @Put(':id/approve')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Approve attendance edit request (Admin/HR)' })
    async approve(@Param('id') id: string, @Body() dto: ReviewAttendanceEditRequestDto, @Req() req: any) {
        return this.service.approve(id, req.crmUser._id.toString(), dto);
    }

    @Put(':id/reject')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Reject attendance edit request (Admin/HR)' })
    async reject(@Param('id') id: string, @Body() dto: ReviewAttendanceEditRequestDto, @Req() req: any) {
        return this.service.reject(id, req.crmUser._id.toString(), dto);
    }
}

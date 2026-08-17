import {
    Controller,
    Get,
    Param,
    Query,
    UseGuards,
    Req,
    Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { CrmReportsService } from './crm-reports.service';
import { CrmRolesGuard } from '../../shared/guards/crm-roles.guard';
import { CrmRoles } from '../../shared/decorators/crm-roles.decorator';
import { CrmRole } from '../../config/constants';
import { Public } from '../../shared/decorators/public.decorator';

@ApiTags('CRM Reports')
@Controller('crm/reports')
@Public()
@UseGuards(AuthGuard('crm-jwt'))
@ApiBearerAuth('JWT-auth')
export class CrmReportsController {
    constructor(private readonly crmReportsService: CrmReportsService) { }

    @Get('dashboard')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Dashboard stats (today counts by status)' })
    async getDashboard(@Req() req: any) {
        return this.crmReportsService.getDashboardStats(req.crmUser.companyId);
    }

    @Get('monthly')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Monthly attendance aggregation report' })
    @ApiQuery({ name: 'startDate', required: true, description: 'YYYY-MM-DD' })
    @ApiQuery({ name: 'endDate', required: true, description: 'YYYY-MM-DD' })
    @ApiQuery({ name: 'department', required: false, description: 'Filter by department name' })
    async getMonthly(
        @Req() req: any,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('department') department?: string,
    ) {
        return this.crmReportsService.getMonthlyReport(req.crmUser.companyId, startDate, endDate, department);
    }

    @Get('employee/:id')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR, CrmRole.MANAGER)
    @ApiOperation({ summary: 'Individual employee attendance report' })
    @ApiQuery({ name: 'startDate', required: true })
    @ApiQuery({ name: 'endDate', required: true })
    async getEmployee(
        @Param('id') id: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.crmReportsService.getEmployeeReport(id, startDate, endDate);
    }

    @Get('export/excel')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Export attendance report to Excel (CSV)' })
    @ApiQuery({ name: 'startDate', required: true })
    @ApiQuery({ name: 'endDate', required: true })
    @ApiQuery({ name: 'department', required: false })
    async exportExcel(
        @Req() req: any,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Res() res: Response,
        @Query('department') department?: string,
    ) {
        const csvData = await this.crmReportsService.exportToCSV(req.crmUser.companyId, startDate, endDate, department);
        const filename = `attendance_report_${startDate}_to_${endDate}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        return res.send(csvData);
    }
}

import {
    Controller, Get, Post, Delete,
    Body, Param, Query,
    UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CrmHolidaysService } from './crm-holidays.service';
import { CreateCrmHolidayDto } from './dto/crm-holiday.dto';
import { CrmRolesGuard } from '../../shared/guards/crm-roles.guard';
import { CrmRoles } from '../../shared/decorators/crm-roles.decorator';
import { CrmRole } from '../../config/constants';
import { Public } from '../../shared/decorators/public.decorator';

@ApiTags('CRM Holidays')
@Controller('crm/holidays')
@Public()
@UseGuards(AuthGuard('crm-jwt'), CrmRolesGuard)
@ApiBearerAuth('JWT-auth')
export class CrmHolidaysController {
    constructor(private readonly crmHolidaysService: CrmHolidaysService) { }

    @Post()
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Create a holiday (Admin/HR only)' })
    async create(@Body() dto: CreateCrmHolidayDto, @Req() req: any) {
        return this.crmHolidaysService.create(req.crmUser.companyId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List all holidays for the company' })
    @ApiQuery({ name: 'year', required: false, description: 'Filter by year (e.g. 2026)' })
    async findAll(@Req() req: any, @Query('year') year?: string) {
        return this.crmHolidaysService.findAll(req.crmUser.companyId, year);
    }

    @Delete(':id')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Delete a holiday (Admin/HR only)' })
    async delete(@Param('id') id: string) {
        return this.crmHolidaysService.delete(id);
    }
}

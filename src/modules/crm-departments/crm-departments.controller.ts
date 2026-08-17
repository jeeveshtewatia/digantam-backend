import {
    Controller, Get, Post, Put, Delete,
    Body, Param, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CrmDepartmentsService } from './crm-departments.service';
import { CreateCrmDepartmentDto, UpdateCrmDepartmentDto } from './dto/crm-department.dto';
import { CrmRolesGuard } from '../../shared/guards/crm-roles.guard';
import { CrmRoles } from '../../shared/decorators/crm-roles.decorator';
import { CrmRole } from '../../config/constants';
import { Public } from '../../shared/decorators/public.decorator';

@ApiTags('CRM Departments')
@Controller('crm/departments')
@Public()
@UseGuards(AuthGuard('crm-jwt'), CrmRolesGuard)
@ApiBearerAuth('JWT-auth')
export class CrmDepartmentsController {
    constructor(private readonly crmDepartmentsService: CrmDepartmentsService) { }

    @Post()
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Create department (Admin/HR)' })
    async create(@Body() dto: CreateCrmDepartmentDto, @Req() req: any) {
        return this.crmDepartmentsService.create(req.crmUser.companyId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List all departments' })
    async findAll(@Req() req: any) {
        return this.crmDepartmentsService.findAll(req.crmUser.companyId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get department by ID' })
    async findById(@Param('id') id: string) {
        return this.crmDepartmentsService.findById(id);
    }

    @Put(':id')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Update department (Admin/HR)' })
    async update(@Param('id') id: string, @Body() dto: UpdateCrmDepartmentDto, @Req() req: any) {
        return this.crmDepartmentsService.update(id, req.crmUser.companyId, dto);
    }

    @Delete(':id')
    @CrmRoles(CrmRole.ADMIN)
    @ApiOperation({ summary: 'Deactivate department (Admin only)' })
    async delete(@Param('id') id: string, @Req() req: any) {
        return this.crmDepartmentsService.delete(id, req.crmUser.companyId);
    }
}

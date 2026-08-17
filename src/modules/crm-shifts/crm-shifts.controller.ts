import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CrmShiftsService } from './crm-shifts.service';
import { CreateCrmShiftDto } from './dto/crm-shift.dto';
import { CrmRolesGuard } from '../../shared/guards/crm-roles.guard';
import { CrmRoles } from '../../shared/decorators/crm-roles.decorator';
import { CrmRole } from '../../config/constants';
import { Public } from '../../shared/decorators/public.decorator';

@ApiTags('CRM Shifts')
@Controller('crm/shifts')
@Public()
@UseGuards(AuthGuard('crm-jwt'), CrmRolesGuard)
@ApiBearerAuth('JWT-auth')
export class CrmShiftsController {
    constructor(private readonly crmShiftsService: CrmShiftsService) { }

    @Post()
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Create a new shift (Admin/HR only)' })
    async create(@Body() dto: CreateCrmShiftDto, @Req() req: any) {
        return this.crmShiftsService.create(dto, req.crmUser);
    }

    @Get()
    @ApiOperation({ summary: 'List all shifts' })
    async findAll(@Req() req: any) {
        return this.crmShiftsService.findAll(req.crmUser.companyId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get shift by ID' })
    async findById(@Param('id') id: string) {
        return this.crmShiftsService.findById(id);
    }

    @Put(':id')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Update shift (Admin/HR only)' })
    async update(@Param('id') id: string, @Body() dto: CreateCrmShiftDto) {
        return this.crmShiftsService.update(id, dto);
    }

    @Delete(':id')
    @CrmRoles(CrmRole.ADMIN)
    @ApiOperation({ summary: 'Delete shift (Admin only)' })
    async delete(@Param('id') id: string) {
        return this.crmShiftsService.delete(id);
    }
}

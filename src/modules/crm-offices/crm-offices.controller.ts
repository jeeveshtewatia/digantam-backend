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
import { CrmOfficesService } from './crm-offices.service';
import { CreateCrmOfficeDto, ValidateLocationDto } from './dto/crm-office.dto';
import { CrmRolesGuard } from '../../shared/guards/crm-roles.guard';
import { CrmRoles } from '../../shared/decorators/crm-roles.decorator';
import { CrmRole } from '../../config/constants';
import { Public } from '../../shared/decorators/public.decorator';

@ApiTags('CRM Offices')
@Controller('crm/offices')
@Public()
@UseGuards(AuthGuard('crm-jwt'), CrmRolesGuard)
@ApiBearerAuth('JWT-auth')
export class CrmOfficesController {
    constructor(private readonly crmOfficesService: CrmOfficesService) { }

    @Post()
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Create office with geo-fence (Admin/HR only)' })
    async create(@Body() dto: CreateCrmOfficeDto, @Req() req: any) {
        return this.crmOfficesService.create(dto, req.crmUser);
    }

    @Get()
    @ApiOperation({ summary: 'List all offices' })
    async findAll(@Req() req: any) {
        return this.crmOfficesService.findAll(req.crmUser.companyId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get office by ID' })
    async findById(@Param('id') id: string) {
        return this.crmOfficesService.findById(id);
    }

    @Put(':id')
    @CrmRoles(CrmRole.ADMIN)
    @ApiOperation({ summary: 'Update office (Admin only)' })
    async update(@Param('id') id: string, @Body() dto: CreateCrmOfficeDto) {
        return this.crmOfficesService.update(id, dto);
    }

    @Delete(':id')
    @CrmRoles(CrmRole.ADMIN)
    @ApiOperation({ summary: 'Delete office (Admin only)' })
    async delete(@Param('id') id: string) {
        return this.crmOfficesService.delete(id);
    }

    @Post('validate-location')
    @ApiOperation({ summary: 'Validate if a lat/lng is within any office geo-fence' })
    async validateLocation(@Body() dto: ValidateLocationDto, @Req() req: any) {
        return this.crmOfficesService.validateLocation(dto, req.crmUser?.companyId || 'default');
    }
}

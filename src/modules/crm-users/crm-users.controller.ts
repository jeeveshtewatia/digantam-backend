import {
    Controller,
    Get, Put, Patch,
    Body, Param, Query,
    UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CrmUsersService } from './crm-users.service';
import { UpdateCrmUserDto } from './dto/update-crm-user.dto';
import { CrmRolesGuard } from '../../shared/guards/crm-roles.guard';
import { CrmRoles } from '../../shared/decorators/crm-roles.decorator';
import { CrmRole } from '../../config/constants';
import { Public } from '../../shared/decorators/public.decorator';

@ApiTags('CRM Users')
@Controller('crm/users')
@Public()
@UseGuards(AuthGuard('crm-jwt'), CrmRolesGuard)
@ApiBearerAuth('JWT-auth')
export class CrmUsersController {
    constructor(private readonly crmUsersService: CrmUsersService) { }

    @Get()
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'List all CRM employees (Admin/HR only)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'search', required: false, description: 'Search by name or email' })
    @ApiQuery({ name: 'department', required: false, description: 'Filter by department' })
    async findAll(
        @Req() req: any,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
        @Query('search') search?: string,
        @Query('department') department?: string,
    ) {
        return this.crmUsersService.findAll(req.crmUser.companyId, +page, +limit, search, department);
    }

    @Get(':id')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR, CrmRole.MANAGER)
    @ApiOperation({ summary: 'Get employee detail' })
    async findById(@Param('id') id: string) {
        return this.crmUsersService.findById(id);
    }

    @Get(':id/leave-balance')
    @ApiOperation({ summary: 'Get employee leave balance' })
    async getLeaveBalance(@Param('id') id: string) {
        return this.crmUsersService.getLeaveBalance(id);
    }

    @Put(':id')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Update employee details (Admin/HR only)' })
    @ApiResponse({ status: 200, description: 'User updated' })
    async update(@Param('id') id: string, @Body() dto: UpdateCrmUserDto, @Req() req: any) {
        return this.crmUsersService.update(id, dto, req.crmUser);
    }

    @Patch(':id/status')
    @CrmRoles(CrmRole.ADMIN)
    @ApiOperation({ summary: 'Activate/deactivate employee (Admin only)' })
    async toggleStatus(
        @Param('id') id: string,
        @Body('isActive') isActive: boolean,
        @Req() req: any,
    ) {
        return this.crmUsersService.toggleStatus(id, isActive, req.crmUser._id.toString());
    }

    @Patch(':id/leave-balance')
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiOperation({ summary: 'Adjust employee leave balance (Admin/HR only)' })
    async updateLeaveBalance(
        @Param('id') id: string,
        @Body('total') total: number,
        @Req() req: any,
    ) {
        return this.crmUsersService.updateLeaveBalance(id, total, req.crmUser._id.toString());
    }
}

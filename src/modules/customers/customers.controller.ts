import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { ProjectValidationGuard } from '../../shared/guards/project-validation.guard';
import { ProjectAuthGuard } from '../../shared/guards/project-auth.guard';
import { RequirePermissions } from '../../shared/decorators/permissions.decorator';
import { ProjectId } from '../../shared/decorators/project-id.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { PERMISSIONS } from '../../config/constants';

@ApiTags('Customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, ProjectValidationGuard, ProjectAuthGuard)
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Post(':projectId')
  @RequirePermissions(PERMISSIONS.CUSTOMER_CREATE)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({ summary: 'Create customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async create(@ProjectId() projectId: string, @Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(projectId, createCustomerDto);
  }

  @Get(':projectId')
  @Public()
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({ summary: 'Get all customers for a project' })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'unit_id', required: false, type: String })
  @ApiQuery({ name: 'email', required: false, type: String })
  @ApiQuery({ name: 'phone', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Customers retrieved successfully' })
  async findAll(@ProjectId() projectId: string, @Query() filters: any) {
    return this.customersService.findAll(projectId, filters);
  }

  @Get(':projectId/:customer_id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_READ)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiParam({ name: 'customer_id', description: 'Customer ID', type: String, example: 'customer_abc123' })
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiResponse({ status: 200, description: 'Customer retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findOne(@ProjectId() projectId: string, @Param('customer_id') customer_id: string) {
    return this.customersService.findOne(projectId, customer_id);
  }

  @Put(':projectId/:customer_id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_UPDATE)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiParam({ name: 'customer_id', description: 'Customer ID', type: String, example: 'customer_abc123' })
  @ApiOperation({ summary: 'Update customer (Admin only)' })
  @ApiResponse({ status: 200, description: 'Customer updated successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async update(
    @ProjectId() projectId: string,
    @Param('customer_id') customer_id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(projectId, customer_id, updateCustomerDto);
  }

  @Delete(':projectId/:customer_id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_DELETE)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiParam({ name: 'customer_id', description: 'Customer ID', type: String, example: 'customer_abc123' })
  @ApiOperation({ summary: 'Delete customer (Admin only)' })
  @ApiResponse({ status: 200, description: 'Customer deleted successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async delete(@ProjectId() projectId: string, @Param('customer_id') customer_id: string) {
    return this.customersService.delete(projectId, customer_id);
  }
}

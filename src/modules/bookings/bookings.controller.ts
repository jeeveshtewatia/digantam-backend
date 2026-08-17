import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { ProjectValidationGuard } from '../../shared/guards/project-validation.guard';
import { ProjectAuthGuard } from '../../shared/guards/project-auth.guard';
import { RequirePermissions } from '../../shared/decorators/permissions.decorator';
import { ProjectId } from '../../shared/decorators/project-id.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { PERMISSIONS } from '../../config/constants';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, ProjectValidationGuard, ProjectAuthGuard)
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post(':projectId/with-customer')
  @Public()
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({
    summary: 'Create booking with customer (Public - No Auth Required)',
    description:
      'Creates a booking along with customer (if new). Updates inventory status to hold/bih. This is the main booking flow. Anyone can create a booking without login. After creation, use GET /bookings/:projectId/:bookingId to view booking details.',
  })
  @ApiResponse({ status: 201, description: 'Booking created successfully' })
  @ApiResponse({ status: 400, description: 'Unit not available or validation error' })
  @ApiResponse({ status: 404, description: 'Unit or customer not found' })
  async createBookingWithCustomer(@ProjectId() projectId: string, @Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.createBookingWithCustomer(projectId, createBookingDto);
  }

  @Get(':projectId')
  @Public()
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({ summary: 'Get all bookings for a project' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  @ApiQuery({ name: 'customer_id', required: false, type: String, description: 'Filter by customer ID' })
  @ApiQuery({ name: 'unit_id', required: false, type: String, description: 'Filter by unit ID' })
  @ApiQuery({ name: 'rm_id', required: false, type: String, description: 'Filter by RM ID' })
  @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
  async findAll(@ProjectId() projectId: string, @Query() filters: any) {
    return this.bookingsService.findAll(projectId, filters);
  }

  @Get(':projectId/detailed')
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({
    summary: 'Get detailed bookings with customer and inventory info',
    description: 'Returns all bookings with populated customer and inventory data',
  })
  @ApiResponse({ status: 200, description: 'Detailed bookings retrieved successfully' })
  async getDetailedBookings(@ProjectId() projectId: string) {
    return this.bookingsService.getDetailedBookings(projectId);
  }

  @Get(':projectId/:bookingId')
  @Public()
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID', type: String, example: 'booking_abc123' })
  @ApiOperation({
    summary: 'Get booking by ID with customer and inventory details (Public - No Auth Required)',
    description:
      'Returns a single booking with populated customer and inventory data. Public endpoint - no authentication required. Use this to show booking details to users after they create a booking.',
  })
  @ApiResponse({ status: 200, description: 'Booking retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async findOne(@ProjectId() projectId: string, @Param('bookingId') bookingId: string) {
    return this.bookingsService.findOne(projectId, bookingId);
  }

  @Put(':projectId/:bookingId')
  @RequirePermissions(PERMISSIONS.BOOKING_UPDATE)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID', type: String, example: 'booking_abc123' })
  @ApiOperation({
    summary: 'Update booking (Admin only)',
    description:
      'Updates booking details. When status changes to "confirmed", inventory becomes "sold". When "cancelled", inventory becomes "available".',
  })
  @ApiResponse({ status: 200, description: 'Booking updated successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async update(
    @ProjectId() projectId: string,
    @Param('bookingId') bookingId: string,
    @Body() updateBookingDto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(projectId, bookingId, updateBookingDto);
  }

  @Put(':projectId/:bookingId/change-unit')
  @RequirePermissions(PERMISSIONS.BOOKING_UPDATE)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID', type: String, example: 'booking_abc123' })
  @ApiOperation({
    summary: 'Change unit for a booking (Admin only)',
    description: 'Updates the unit for an existing booking. Old unit becomes available, new unit becomes hold.',
  })
  @ApiResponse({ status: 200, description: 'Booking unit updated successfully' })
  @ApiResponse({ status: 404, description: 'Booking or new unit not found' })
  @ApiResponse({ status: 400, description: 'New unit not available' })
  async updateBookingUnit(
    @ProjectId() projectId: string,
    @Param('bookingId') bookingId: string,
    @Body('unit_id') unitId: string,
  ) {
    return this.bookingsService.updateBookingUnit(projectId, bookingId, unitId);
  }

  @Post(':projectId/release-expired')
  @RequirePermissions(PERMISSIONS.BOOKING_UPDATE)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({
    summary: 'Release expired bookings (Admin only)',
    description:
      'Cancels pending bookings older than the hold time and releases their inventory. Default hold time is 72 hours.',
  })
  @ApiQuery({ name: 'holdTimeHours', required: false, type: Number, description: 'Hold time in hours (default: 72)' })
  @ApiResponse({ status: 200, description: 'Expired bookings released successfully' })
  async releaseExpiredBookings(
    @ProjectId() projectId: string,
    @Query('holdTimeHours') holdTimeHours?: number,
  ) {
    return this.bookingsService.releaseExpiredBookings(projectId, holdTimeHours);
  }

  @Delete(':projectId/:bookingId')
  @RequirePermissions(PERMISSIONS.BOOKING_DELETE)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID', type: String, example: 'booking_abc123' })
  @ApiOperation({
    summary: 'Delete booking (Admin only)',
    description: 'Deletes a booking and optionally releases the inventory',
  })
  @ApiQuery({ name: 'releaseInventory', required: false, type: Boolean, description: 'Release inventory (default: true)' })
  @ApiResponse({ status: 200, description: 'Booking deleted successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async delete(
    @ProjectId() projectId: string,
    @Param('bookingId') bookingId: string,
    @Query('releaseInventory') releaseInventory?: boolean,
  ) {
    return this.bookingsService.delete(projectId, bookingId, releaseInventory !== false);
  }
}

import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CommonUtilsService } from '../../shared/services/common-utils.service';

@Injectable()
export class BookingsService {
  constructor(
    private projectsUtilsService: ProjectsUtilsService,
    private commonUtilsService: CommonUtilsService,
  ) {}

  /**
   * Create booking with customer (main flow)
   * - Creates customer (if new)
   * - Creates booking
   * - Updates inventory status to 'hold'
   */
  async createBookingWithCustomer(projectId: string, createBookingDto: CreateBookingDto) {
    const {
      unit_id,
      project_id,
      customer_id,
      ref_or_cheque,
      rm_name,
      rm_id,
      documents,
      aadhar,
      pancard,
      cheque_pic,
      cheque_amount,
      partner_details,
      kyc,
      tcb,
      metadata,
      // Customer fields
      firstName,
      lastName,
      email,
      phone,
      alt_phone,
      address,
      type,
      ...otherFields // Any additional custom fields
    } = createBookingDto;

    // Verify project matches
    if (project_id !== projectId) {
      throw new BadRequestException('Project ID mismatch');
    }

    // Get models
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);
    const CustomerModel = await this.projectsUtilsService.getCustomersModel(projectId);
    const BookingModel = await this.projectsUtilsService.getBookingsModel(projectId);

    // Check if unit exists and is available
    const unit = await InventoryModel.findOne({ id: unit_id, project_id: projectId });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    if (!['available', 'Available', 'AVAILABLE'].includes(unit.status)) {
      throw new BadRequestException('Unit is not available');
    }

    // Create or use existing customer
    let finalCustomerId = customer_id;

    if (!customer_id) {
      // Create new customer - explicitly include all customer fields
      finalCustomerId = this.commonUtilsService.generateId(10);
      const customerData: any = {
        customer_id: finalCustomerId,
        project_id: projectId,
        firstName,
        lastName,
        email,
        phone, // Explicitly include phone
        alt_phone,
        address,
        type,
        ...otherFields, // Include any additional custom customer fields
      };

      // Remove undefined fields to keep data clean
      Object.keys(customerData).forEach((key) => {
        if (customerData[key] === undefined) {
          delete customerData[key];
        }
      });

      await CustomerModel.create(customerData);
    } else {
      // Verify customer exists
      const existingCustomer = await CustomerModel.findOne({
        customer_id,
        project_id: projectId,
      });

      if (!existingCustomer) {
        throw new NotFoundException('Customer not found');
      }
    }

    // Create booking
    const booking = await BookingModel.create({
      id: this.commonUtilsService.generateId(10),
      customer_id: finalCustomerId,
      unit_id,
      project_id: projectId,
      ref_or_cheque,
      status: 'pending',
      time: new Date(),
      rm_name: createBookingDto.rm_name,
      rm_id: createBookingDto.rm_id,
      documents: createBookingDto.documents || [],
      aadhar: createBookingDto.aadhar || [],
      pancard: createBookingDto.pancard || [],
      cheque_pic: createBookingDto.cheque_pic || [],
      cheque_amount: createBookingDto.cheque_amount,
      partner_details: createBookingDto.partner_details,
      kyc: createBookingDto.kyc,
      tcb: createBookingDto.tcb,
      metadata: createBookingDto.metadata || {},
    });

    // Update inventory status
    let inventoryStatus = 'hold';
    
    // Special case: if ref_or_cheque is provided for certain projects, status becomes 'bih' (Booking In Hand)
    if (ref_or_cheque && ref_or_cheque.length > 0) {
      inventoryStatus = 'bih';
    }

    // Update inventory status - use updateOne and verify it worked
    const inventoryUpdateResult = await InventoryModel.updateOne(
      { id: unit_id, project_id: projectId },
      { $set: { status: inventoryStatus } },
    );

    if (inventoryUpdateResult.matchedCount === 0) {
      throw new NotFoundException(`Inventory unit ${unit_id} not found for update`);
    }

    if (inventoryUpdateResult.modifiedCount === 0) {
      // Log warning but don't fail - status might already be set
      console.warn(`Inventory status update did not modify unit ${unit_id}. Current status might already be ${inventoryStatus}`);
    }

    return {
      message: 'Booking created successfully',
      booking,
      inventory_status: inventoryStatus,
    };
  }

  /**
   * Get all bookings for a project
   */
  async findAll(projectId: string, filters?: any) {
    const BookingModel = await this.projectsUtilsService.getBookingsModel(projectId);
    
    const query: any = { project_id: projectId };

    // Apply filters
    if (filters.status) query.status = filters.status;
    if (filters.customer_id) query.customer_id = filters.customer_id;
    if (filters.unit_id) query.unit_id = filters.unit_id;
    if (filters.rm_id) query.rm_id = filters.rm_id;

    const bookings = await BookingModel.find(query).sort({ createdAt: -1 });
    return bookings;
  }

  /**
   * Get detailed booking by ID (with customer and inventory info)
   */
  async findOne(projectId: string, bookingId: string) {
    const BookingModel = await this.projectsUtilsService.getBookingsModel(projectId);
    const CustomerModel = await this.projectsUtilsService.getCustomersModel(projectId);
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    const booking = await BookingModel.findOne({
      id: bookingId,
      project_id: projectId,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Get related customer
    const customer = await CustomerModel.findOne({
      customer_id: booking.customer_id,
      project_id: projectId,
    });

    // Get related inventory
    const inventory = await InventoryModel.findOne({
      id: booking.unit_id,
      project_id: projectId,
    });

    return {
      ...booking.toObject(),
      customer: customer?.toObject() || null,
      inventory: inventory?.toObject() || null,
    };
  }

  /**
   * Update booking (mainly status changes)
   * - When status = 'cancelled', inventory becomes 'available'
   * - When status = 'confirmed', inventory becomes 'sold'
   */
  async update(projectId: string, bookingId: string, updateBookingDto: UpdateBookingDto) {
    const BookingModel = await this.projectsUtilsService.getBookingsModel(projectId);
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    const { status, ...otherUpdates } = updateBookingDto;

    // Find booking first to get current status and unit_id
    const existingBooking = await BookingModel.findOne({ id: bookingId, project_id: projectId });
    if (!existingBooking) {
      throw new NotFoundException('Booking not found');
    }

    // Update booking (allow updating any status, not just pending)
    const booking = await BookingModel.findOneAndUpdate(
      { id: bookingId, project_id: projectId },
      { ...otherUpdates, ...(status && { status }) },
      { new: true },
    );

    if (!booking) {
      throw new NotFoundException('Booking update failed');
    }

    // Update inventory based on status change
    if (status) {
      let inventoryStatus: string | null = null;

      if (status === 'cancelled') {
        inventoryStatus = 'available';
      } else if (status === 'confirmed') {
        inventoryStatus = 'sold';
      }

      if (inventoryStatus) {
        // Update inventory - remove status restriction to allow update from any status
        const inventoryUpdateResult = await InventoryModel.updateOne(
          {
            id: booking.unit_id,
            project_id: projectId,
          },
          { $set: { status: inventoryStatus } },
        );

        if (inventoryUpdateResult.matchedCount === 0) {
          console.warn(`Inventory unit ${booking.unit_id} not found for status update`);
        } else if (inventoryUpdateResult.modifiedCount === 0) {
          console.warn(`Inventory status update did not modify unit ${booking.unit_id}. Current status might already be ${inventoryStatus}`);
        }
      }
    }

    return {
      message: 'Booking updated successfully',
      booking,
    };
  }

  /**
   * Update booking unit (change unit for a booking)
   * - Old unit becomes 'available'
   * - New unit becomes 'hold'
   */
  async updateBookingUnit(projectId: string, bookingId: string, newUnitId: string) {
    const BookingModel = await this.projectsUtilsService.getBookingsModel(projectId);
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    // Check if new unit is available
    const newUnit = await InventoryModel.findOne({
      id: newUnitId,
      project_id: projectId,
    });

    if (!newUnit) {
      throw new NotFoundException('New unit not found');
    }

    // Check if new unit is available (case-insensitive)
    const newUnitStatus = (newUnit.status || '').toLowerCase();
    if (newUnitStatus !== 'available') {
      throw new BadRequestException(`New unit is not available. Current status: ${newUnit.status}`);
    }

    // Find existing booking
    const existingBooking = await BookingModel.findOne({
      id: bookingId,
      project_id: projectId,
    });

    if (!existingBooking) {
      throw new NotFoundException('Booking not found');
    }

    const oldUnitId = existingBooking.unit_id;

    // Update booking with new unit
    const booking = await BookingModel.findOneAndUpdate(
      { id: bookingId, project_id: projectId },
      { unit_id: newUnitId },
      { new: true },
    );

    // Release old unit
    const oldUnitUpdateResult = await InventoryModel.updateOne(
      { id: oldUnitId, project_id: projectId },
      { $set: { status: 'available' } },
    );

    if (oldUnitUpdateResult.matchedCount === 0) {
      console.warn(`Old inventory unit ${oldUnitId} not found for status update`);
    } else if (oldUnitUpdateResult.modifiedCount === 0) {
      console.warn(`Old inventory status update did not modify unit ${oldUnitId}`);
    }

    // Hold new unit
    const newUnitUpdateResult = await InventoryModel.updateOne(
      { id: newUnitId, project_id: projectId },
      { $set: { status: 'hold' } },
    );

    if (newUnitUpdateResult.matchedCount === 0) {
      throw new NotFoundException(`New inventory unit ${newUnitId} not found for status update`);
    } else if (newUnitUpdateResult.modifiedCount === 0) {
      console.warn(`New inventory status update did not modify unit ${newUnitId}`);
    }

    return {
      message: 'Booking unit updated successfully',
      booking,
      old_unit_id: oldUnitId,
      new_unit_id: newUnitId,
    };
  }

  /**
   * Cancel expired bookings and release inventory
   * (Bookings older than hold time and still pending)
   */
  async releaseExpiredBookings(projectId: string, holdTimeHours: number = 72) {
    const BookingModel = await this.projectsUtilsService.getBookingsModel(projectId);
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    const holdTime = holdTimeHours * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - holdTime);

    const expiredBookings = await BookingModel.find({
      project_id: projectId,
      status: 'pending',
      time: { $lte: cutoffTime },
    });

    const releasedUnits: string[] = [];

    for (const booking of expiredBookings) {
      const { unit_id, _id } = booking;

      // Release inventory (case-insensitive status check)
      const inventoryUpdateResult = await InventoryModel.updateOne(
        {
          id: unit_id,
          project_id: projectId,
          status: { $in: ['hold', 'bih', 'Hold', 'BIH', 'Bih'] },
        },
        { $set: { status: 'available' } },
      );

      if (inventoryUpdateResult.matchedCount === 0) {
        console.warn(`Inventory unit ${unit_id} not found or status doesn't match for release`);
      } else if (inventoryUpdateResult.modifiedCount === 0) {
        console.warn(`Inventory status update did not modify unit ${unit_id}`);
      }

      // Cancel booking
      await BookingModel.updateOne({ _id }, { $set: { status: 'cancelled' } });

      releasedUnits.push(unit_id);
    }

    return {
      message: `Released ${releasedUnits.length} expired bookings`,
      released_units: releasedUnits,
      count: releasedUnits.length,
    };
  }

  /**
   * Get detailed bookings (with customer and inventory data)
   */
  async getDetailedBookings(projectId: string) {
    const BookingModel = await this.projectsUtilsService.getBookingsModel(projectId);
    const CustomerModel = await this.projectsUtilsService.getCustomersModel(projectId);
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    const bookings = await BookingModel.find({ project_id: projectId }).sort({ createdAt: -1 });

    const detailedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const customer = await CustomerModel.findOne({
          customer_id: booking.customer_id,
          project_id: projectId,
        });

        const inventory = await InventoryModel.findOne({
          id: booking.unit_id,
          project_id: projectId,
        });

        return {
          ...booking.toObject(),
          ...(customer ? customer.toObject() : null),
          
        };
      }),
    );

    return detailedBookings;
  }

  /**
   * Delete booking (and optionally release inventory)
   */
  async delete(projectId: string, bookingId: string, releaseInventory: boolean = true) {
    const BookingModel = await this.projectsUtilsService.getBookingsModel(projectId);
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    const booking = await BookingModel.findOne({
      id: bookingId,
      project_id: projectId,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Release inventory if requested
    if (releaseInventory) {
      // Release inventory regardless of booking status
      const inventoryUpdateResult = await InventoryModel.updateOne(
        { id: booking.unit_id, project_id: projectId },
        { $set: { status: 'available' } },
      );

      if (inventoryUpdateResult.matchedCount === 0) {
        console.warn(`Inventory unit ${booking.unit_id} not found for status update`);
      } else if (inventoryUpdateResult.modifiedCount === 0) {
        console.warn(`Inventory status update did not modify unit ${booking.unit_id}`);
      }
    }

    await BookingModel.deleteOne({ id: bookingId, project_id: projectId });

    return {
      message: 'Booking deleted successfully',
      booking_id: bookingId,
    };
  }
}

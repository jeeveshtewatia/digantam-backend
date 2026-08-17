import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CommonUtilsService } from '../../shared/services/common-utils.service';

@Injectable()
export class CustomersService {
  constructor(
    private projectsUtilsService: ProjectsUtilsService,
    private commonUtilsService: CommonUtilsService,
  ) {}

  async create(projectId: string, createCustomerDto: CreateCustomerDto) {
    const CustomerModel = await this.projectsUtilsService.getCustomersModel(projectId);

    // Generate unique customer ID
    const customer_id = this.commonUtilsService.generateId(12);

    // Create customer
    const customer = await CustomerModel.create({
      ...createCustomerDto,
      customer_id,
      project_id: projectId,
    });

    return {
      message: 'Customer created successfully',
      customer,
    };
  }

  async findAll(projectId: string, filters?: any) {
    const CustomerModel = await this.projectsUtilsService.getCustomersModel(projectId);

    const query: any = { project_id: projectId };

    // Apply filters
    if (filters?.type) {
      query.type = filters.type;
    }
    if (filters?.unit_id) {
      query.unit_id = filters.unit_id;
    }
    if (filters?.email) {
      query.email = new RegExp(filters.email, 'i');
    }
    if (filters?.phone) {
      query.phone = filters.phone;
    }

    const customers = await CustomerModel.find(query).sort({ createdAt: -1 });

    return {
      count: customers.length,
      customers,
    };
  }

  async findOne(projectId: string, customer_id: string) {
    const CustomerModel = await this.projectsUtilsService.getCustomersModel(projectId);
    const customer = await CustomerModel.findOne({ customer_id, project_id: projectId });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async update(projectId: string, customer_id: string, updateCustomerDto: UpdateCustomerDto) {
    const CustomerModel = await this.projectsUtilsService.getCustomersModel(projectId);

    const customer = await CustomerModel.findOneAndUpdate(
      { customer_id, project_id: projectId },
      { $set: updateCustomerDto },
      { new: true, runValidators: true },
    );

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      message: 'Customer updated successfully',
      customer,
    };
  }

  async delete(projectId: string, customer_id: string) {
    const CustomerModel = await this.projectsUtilsService.getCustomersModel(projectId);

    const customer = await CustomerModel.findOneAndDelete({ customer_id, project_id: projectId });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      message: 'Customer deleted successfully',
    };
  }
}

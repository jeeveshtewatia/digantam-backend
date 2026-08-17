import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Model, Schema } from 'mongoose';
import { getInventorySchema, getCustomerSchema, getUserSchema, getProjectSchema, getBookingSchema, getCSVHistorySchema, getChannelPartnerSchema, getCrmUserSchema, getCrmOfficeSchema, getCrmShiftSchema, getCrmAttendanceSchema, getCrmLeaveSchema, getCrmAuditLogSchema, getCrmHolidaySchema, getCrmDepartmentSchema, getCrmAttendanceEditRequestSchema, getCrmPasswordResetSchema } from './schemas';



@Injectable()
export class ProjectsUtilsService {
  constructor(@InjectConnection() private readonly connection: Connection) { }

  // Check if project exists
  async isValidProjectId(projectId: string): Promise<boolean> {
    const ProjectModel = this.getProjectModel();
    const project = await ProjectModel.findOne({ projectId, is_active: true });
    return !!project;
  }

  // Get collection names for a project
  getCollectionName(projectId: string) {
    return {
      inventories: `${projectId}_inventories`,
      customers: `${projectId}_customers`,
      bookings: `${projectId}_bookings`,
      channelPartners: 'channel_partners', // Common collection for all projects
      csvHistory: 'csv_update_history', // Global collection for all projects
    };
  }

  // Get Project Model
  getProjectModel(): Model<any> {
    const collectionName = 'projects';
    const schema = getProjectSchema();

    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }

    return this.connection.model(collectionName, schema);
  }

  // Get User Model (Global)
  getUserModel(): Model<any> {
    const collectionName = 'users';
    const schema = getUserSchema();

    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }

    return this.connection.model(collectionName, schema);
  }

  // Get Inventory Model for a specific project
  async getInventoriesModel(projectId: string): Promise<Model<any>> {
    const isValid = await this.isValidProjectId(projectId);
    if (!isValid) {
      throw new Error(`Invalid project ID: ${projectId}`);
    }

    const collectionName = this.getCollectionName(projectId).inventories;
    const ProjectModel = this.getProjectModel();
    const project = await ProjectModel.findOne({ projectId });

    const schema = getInventorySchema(project?.inventorySchema);

    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }

    return this.connection.model(collectionName, schema);
  }

  // Get Customer Model for a specific project
  async getCustomersModel(projectId: string): Promise<Model<any>> {
    const isValid = await this.isValidProjectId(projectId);
    if (!isValid) {
      throw new Error(`Invalid project ID: ${projectId}`);
    }

    const collectionName = this.getCollectionName(projectId).customers;
    const ProjectModel = this.getProjectModel();
    const project = await ProjectModel.findOne({ projectId });

    const schema = getCustomerSchema(project?.customerSchema);

    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }

    return this.connection.model(collectionName, schema);
  }

  // Get Booking Model for a specific project
  async getBookingsModel(projectId: string): Promise<Model<any>> {
    const isValid = await this.isValidProjectId(projectId);
    if (!isValid) {
      throw new Error(`Invalid project ID: ${projectId}`);
    }

    const collectionName = this.getCollectionName(projectId).bookings;
    const schema = getBookingSchema();

    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }

    return this.connection.model(collectionName, schema);
  }

  // Get CSV History Model (global - tracks all CSV updates across projects)
  getCSVHistoryModel(): Model<any> {
    const collectionName = 'csv_update_history';
    const schema = getCSVHistorySchema();

    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }

    return this.connection.model(collectionName, schema);
  }

  // Get Channel Partner Model (Global - filtered by project_id)
  async getChannelPartnersModel(): Promise<Model<any>> {
    const collectionName = 'channel_partners';
    const schema = getChannelPartnerSchema();

    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }

    return this.connection.model(collectionName, schema);
  }

  // ============================================================
  // CRM - Attendance Module Models
  // ============================================================

  getCrmUserModel(): Model<any> {
    const collectionName = 'crm_users';
    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }
    return this.connection.model(collectionName, getCrmUserSchema());
  }

  getCrmOfficeModel(): Model<any> {
    const collectionName = 'crm_offices';
    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }
    return this.connection.model(collectionName, getCrmOfficeSchema());
  }

  getCrmShiftModel(): Model<any> {
    const collectionName = 'crm_shifts';
    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }
    return this.connection.model(collectionName, getCrmShiftSchema());
  }

  getCrmAttendanceModel(): Model<any> {
    const collectionName = 'crm_attendance';
    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }
    return this.connection.model(collectionName, getCrmAttendanceSchema());
  }

  getCrmLeaveModel(): Model<any> {
    const collectionName = 'crm_leaves';
    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }
    return this.connection.model(collectionName, getCrmLeaveSchema());
  }

  getCrmAuditLogModel(): Model<any> {
    const collectionName = 'crm_audit_logs';
    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }
    return this.connection.model(collectionName, getCrmAuditLogSchema());
  }

  getCrmHolidayModel(): Model<any> {
    const collectionName = 'crm_holidays';
    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }
    return this.connection.model(collectionName, getCrmHolidaySchema());
  }

  getCrmDepartmentModel(): Model<any> {
    const collectionName = 'crm_departments';
    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }
    return this.connection.model(collectionName, getCrmDepartmentSchema());
  }

  getCrmAttendanceEditRequestModel(): Model<any> {
    const collectionName = 'crm_attendance_requests';
    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }
    return this.connection.model(collectionName, getCrmAttendanceEditRequestSchema());
  }


  getCrmPasswordResetModel(): Model<any> {
    const collectionName = 'crm_password_resets';
    if (this.connection.models[collectionName]) {
      return this.connection.models[collectionName];
    }
    return this.connection.model(collectionName, getCrmPasswordResetSchema());
  }
}



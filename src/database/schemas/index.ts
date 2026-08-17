import { Schema } from 'mongoose';
import { UserRole, CustomerType, DEFAULT_INVENTORY_SCHEMA, DEFAULT_CUSTOMER_SCHEMA, CrmRole, AttendanceStatus, LeaveType, LeaveStatus } from '../../config/constants';



// Helper function to create schema from JSON definition
function createSchemaFromDefinition(schemaDefinition: any): Schema {
  const schemaFields: any = {
    project_id: { type: String, required: true },
  };

  for (const [fieldName, fieldConfig] of Object.entries(schemaDefinition)) {
    const config: any = fieldConfig;
    const fieldDef: any = {};

    switch (config.type) {
      case 'String':
        fieldDef.type = String;
        break;
      case 'Number':
        fieldDef.type = Number;
        break;
      case 'Boolean':
        fieldDef.type = Boolean;
        break;
      case 'Date':
        fieldDef.type = Date;
        break;
      case 'Array':
        fieldDef.type = Array;
        break;
      case 'Object':
        fieldDef.type = Object;
        break;
      default:
        fieldDef.type = Schema.Types.Mixed;
    }

    if (config.required) fieldDef.required = config.required;
    if (config.default !== undefined) fieldDef.default = config.default;
    if (config.unique) fieldDef.unique = config.unique;
    if (config.enum) fieldDef.enum = config.enum;

    schemaFields[fieldName] = fieldDef;
  }

  return new Schema(schemaFields, { timestamps: true });
}

// Project Schema
export function getProjectSchema(): Schema {
  return new Schema(
    {
      projectId: { type: String, required: true, unique: true },
      projectName: { type: String, required: true },
      projectType: { type: String, required: true },
      description: { type: String },
      frontendUrl: { type: String }, // Production/frontend URL - Admin can access project directly from dashboard
      inventorySchema: { type: Object, default: DEFAULT_INVENTORY_SCHEMA },
      customerSchema: { type: Object, default: DEFAULT_CUSTOMER_SCHEMA },
      requires_auth: { type: Boolean, default: true },
      allowed_roles: { type: [String], default: ['admin', 'rm', 'user'] },
      settings: { type: Object, default: {} },
      is_active: { type: Boolean, default: true },
    },
    { timestamps: true },
  );
}

// User Schema (Global - handles all users across projects)
export function getUserSchema(): Schema {
  return new Schema(
    {
      uid: { type: String },
      email: {
        type: String,
        required: [true, 'Email is required'],
        // Removed unique: true - email will be unique per project_id via compound index
        match: [
          /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
          'Please enter a valid email',
        ],
      },
      password: { type: String, required: [true, 'Password is required'] },
      firstName: { type: String, required: [true, 'First name is required'] },
      lastName: { type: String },
      phone: { type: String },
      role: {
        type: String,
        required: true,
        enum: Object.values(UserRole),
        default: UserRole.USER,
      },
      project_id: { type: String }, // Project-specific users will have this
      permissions: { type: [String], default: [] },
      is_active: { type: Boolean, default: true },
      created_by: {
        // Track who created this user
        user_id: { type: String },
        email: { type: String },
        role: { type: String },
        name: { type: String }, // firstName + lastName
      },
    },
    { timestamps: true },
  );
}

// Dynamic Inventory Schema
// Note: customSchema parameter now contains already-merged schema (defaults + custom)
// Merging happens during project creation/update in ProjectsService
export function getInventorySchema(customSchema?: any): Schema {
  // customSchema already contains merged default + custom fields from project document
  // If not provided, fallback to default schema
  const schemaDefinition = customSchema || DEFAULT_INVENTORY_SCHEMA;

  const baseFields = {
    id: { type: String, unique: true },
    project_id: { type: String, required: true },
    status: { type: String, default: 'available' },
  };

  const customFields = createSchemaFromDefinition(schemaDefinition);

  // Merge base fields with schema fields
  const mergedSchema = new Schema(
    {
      ...baseFields,
      ...customFields.obj,
    },
    { timestamps: true },
  );

  return mergedSchema;
}

// Dynamic Customer Schema
// Note: customSchema parameter now contains already-merged schema (defaults + custom)
// Merging happens during project creation/update in ProjectsService
export function getCustomerSchema(customSchema?: any): Schema {
  // customSchema already contains merged default + custom fields from project document
  // If not provided, fallback to default schema
  const schemaDefinition = customSchema || DEFAULT_CUSTOMER_SCHEMA;

  const baseFields = {
    customer_id: { type: String, required: true, unique: true },
    project_id: { type: String, required: true },
    type: { type: String, enum: Object.values(CustomerType), default: CustomerType.ENQUIRY },
  };

  const customFields = createSchemaFromDefinition(schemaDefinition);

  const mergedSchema = new Schema(
    {
      ...baseFields,
      ...customFields.obj,
    },
    { timestamps: true },
  );

  return mergedSchema;
}

// Booking Schema
export function getBookingSchema(): Schema {
  return new Schema(
    {
      id: { type: String, required: true, unique: true },
      customer_id: { type: String, required: [true, 'Customer ID is required'] },
      unit_id: { type: String, required: [true, 'Unit ID is required'] },
      project_id: { type: String, required: [true, 'Project ID is required'] },
      time: { type: Date, default: Date.now },
      status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled'],
        default: 'pending',
      },
      rm_name: { type: String },
      rm_id: { type: String },
      ref_or_cheque: { type: String },
      documents: { type: [String], default: [] },
      aadhar: { type: [String], default: [] },
      pancard: { type: [String], default: [] },
      cheque_pic: { type: [String], default: [] },
      cheque_amount: { type: String },
      partner_details: { type: String },
      kyc: { type: Object },
      tcb: { type: String },
      remark1: { type: String },
      remark2: { type: String },
      remark3: { type: String },
      metadata: { type: Object, default: {} },
    },
    { timestamps: true },
  );
}

// CSV Update History Schema (for tracking backups and rollbacks)
// Hybrid storage: MongoDB for recent (15 days), S3 for archived
export function getCSVHistorySchema(): Schema {
  return new Schema(
    {
      id: { type: String, required: true, unique: true },
      project_id: { type: String, required: true },
      action: { type: String, required: true, enum: ['CSV Upload', 'Rollback'], default: 'CSV Upload' },
      user: {
        id: { type: String, required: true },
        email: { type: String, required: true },
        name: { type: String },
        role: { type: String },
      },
      // Hybrid storage fields
      storage_type: {
        type: String,
        enum: ['mongodb', 's3', 'both'],
        default: 'mongodb',
        required: true
      },
      // MongoDB storage (for recent backups < 15 days)
      backup_data: { type: String }, // CSV content stored directly
      // S3 storage (for archived backups)
      backup_s3_key: { type: String }, // S3 object key
      backup_s3_bucket: { type: String }, // S3 bucket name
      // Common metadata
      backup_filename: { type: String, required: true },
      backup_size: { type: Number }, // Size in bytes
      backup_record_count: { type: Number }, // Number of records
      changes: {
        total: { type: Number, default: 0 },
        success: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        skipped: { type: Number, default: 0 },
      },
      errors: { type: [String], default: [] },
      timestamp: { type: Date, default: Date.now },
      // Archive tracking
      archived_at: { type: Date }, // When moved to S3
      archive_status: {
        type: String,
        enum: ['active', 'archived', 'failed'],
        default: 'active'
      },
    },
    { timestamps: true },
  );
}
// Channel Partner Schema
export function getChannelPartnerSchema(): Schema {
  return new Schema(
    {
      id: { type: String, required: true, unique: true },
      project_id: { type: String, required: true },
      name: { type: String, required: true },
      email: { type: String },
      phone: { type: String },
      firm_name: { type: String },
      status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    },
    { timestamps: true },
  );
}

// ============================================================
// CRM - Attendance Module Schemas
// ============================================================

// CRM User Schema (collection: crm_users)
export function getCrmUserSchema(): Schema {
  const schema = new Schema(
    {
      companyId: { type: String, required: true, default: 'default' },
      employeeId: { type: String }, // Employee code / staff ID
      name: { type: String, required: true },
      email: {
        type: String,
        required: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email'],
      },
      phoneNumber: { type: String },
      passwordHash: { type: String, required: true },
      role: {
        type: String,
        required: true,
        enum: Object.values(CrmRole),
        default: CrmRole.EMPLOYEE,
      },
      department: { type: String },
      shiftId: { type: Schema.Types.ObjectId, ref: 'crm_shifts' },
      reportingManagerId: { type: Schema.Types.ObjectId, ref: 'crm_users', default: null },
      profileImage: { type: String, default: null },
      leaveBalance: {
        total: { type: Number, default: 0 },         // Current paid leave balance (max 6)
        yearlyQuota: { type: Number, default: 0 },   // Pro-rated: (months remaining × 2) set on creation
        yearlyUsed: { type: Number, default: 0 },    // Paid leaves consumed this calendar year
      },
      deviceInfo: [
        {
          deviceId: { type: String },
          ip: { type: String },
          lastLogin: { type: Date },
        },
      ],
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
  );

  // Unique email per companyId
  schema.index({ email: 1, companyId: 1 }, { unique: true });
  return schema;
}


// CRM Office Schema (collection: crm_offices)
export function getCrmOfficeSchema(): Schema {
  const schema = new Schema(
    {
      companyId: { type: String, required: true, default: 'default' },
      name: { type: String, required: true },
      location: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
          required: true,
        },
        coordinates: {
          type: [Number], // [lng, lat]
          required: true,
        },
      },
      allowedRadiusMeters: { type: Number, required: true, default: 100 },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
  );

  schema.index({ location: '2dsphere' });
  return schema;
}

// CRM Shift Schema (collection: crm_shifts)
export function getCrmShiftSchema(): Schema {
  return new Schema(
    {
      companyId: { type: String, required: true, default: 'default' },
      name: { type: String, required: true },
      shiftType: { type: String, enum: ['fixed', 'flexible'], default: 'fixed' },
      startTime: { type: String, required: true }, // HH:mm
      endTime: { type: String, required: true },   // HH:mm
      graceMinutes: { type: Number, default: 10 },
      workingMinutes: { type: Number, default: 480 }, // 8 hours
      halfDayThresholdMinutes: { type: Number, default: 240 }, // 4 hours = half day
      overtimeThresholdMinutes: { type: Number, default: 0 },  // Minutes beyond workingMinutes = overtime
    },
    { timestamps: true },
  );
}


// CRM Attendance Schema (collection: crm_attendance)
export function getCrmAttendanceSchema(): Schema {
  const schema = new Schema(
    {
      companyId: { type: String, required: true, default: 'default' },
      userId: { type: Schema.Types.ObjectId, ref: 'crm_users', required: true },
      date: { type: String, required: true }, // YYYY-MM-DD

      checkIn: {
        time: { type: Date },
        location: {
          type: { type: String, enum: ['Point'] },
          coordinates: { type: [Number] }, // [lng, lat]
        },
        ip: { type: String },
        deviceId: { type: String },
        selfieUrl: { type: String },
      },

      checkOut: {
        time: { type: Date },
        location: {
          type: { type: String, enum: ['Point'] },
          coordinates: { type: [Number] },
        },
      },

      breaks: [
        {
          startTime: { type: Date },
          endTime: { type: Date },
        },
      ],

      totalWorkMinutes: { type: Number, default: 0 },
      breakMinutes: { type: Number, default: 0 },
      lateMinutes: { type: Number, default: 0 },
      overtimeMinutes: { type: Number, default: 0 },

      status: {
        type: String,
        enum: Object.values(AttendanceStatus),
        default: AttendanceStatus.ABSENT,
      },
      remarks: { type: String },
    },
    { timestamps: true },
  );

  schema.index({ userId: 1, date: 1 }, { unique: true });
  schema.index({ companyId: 1, date: 1 });
  schema.index({ date: 1 });
  return schema;
}

// CRM Leave Schema (collection: crm_leaves)
export function getCrmLeaveSchema(): Schema {
  return new Schema(
    {
      companyId: { type: String, required: true, default: 'default' },
      userId: { type: Schema.Types.ObjectId, ref: 'crm_users', required: true },
      type: {
        type: String,
        required: true,
        enum: Object.values(LeaveType),
        default: LeaveType.LEAVE,
      },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      totalDays: { type: Number, required: true },   // 0.5 for half-day, whole number for full days
      paidDays: { type: Number, default: 0 },        // Days covered by paid balance
      unpaidDays: { type: Number, default: 0 },      // Days salary will be deducted
      isHalfDay: { type: Boolean, default: false },
      halfDayPeriod: { type: String, enum: ['morning', 'evening', null], default: null },
      reason: { type: String },
      status: {
        type: String,
        enum: Object.values(LeaveStatus),
        default: LeaveStatus.PENDING,
      },
      approvedBy: { type: Schema.Types.ObjectId, ref: 'crm_users' },
      cancelledBy: { type: Schema.Types.ObjectId, ref: 'crm_users', default: null },
      cancelledAt: { type: Date, default: null },
      cancelReason: { type: String, default: null },
    },
    { timestamps: true },
  );
}

// CRM Holiday Schema (collection: crm_holidays)
export function getCrmHolidaySchema(): Schema {
  const schema = new Schema(
    {
      companyId: { type: String, required: true, default: 'default' },
      name: { type: String, required: true },
      date: { type: String, required: true }, // YYYY-MM-DD
      type: {
        type: String,
        enum: ['national', 'optional', 'company'],
        default: 'company',
      },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
  );
  schema.index({ companyId: 1, date: 1 }, { unique: true });
  return schema;
}

// CRM Department Schema (collection: crm_departments)
export function getCrmDepartmentSchema(): Schema {
  const schema = new Schema(
    {
      companyId: { type: String, required: true, default: 'default' },
      name: { type: String, required: true },
      description: { type: String },
      managerId: { type: Schema.Types.ObjectId, ref: 'crm_users', default: null },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
  );
  schema.index({ companyId: 1, name: 1 }, { unique: true });
  return schema;
}

// CRM Attendance Edit Request Schema (collection: crm_attendance_requests)
export function getCrmAttendanceEditRequestSchema(): Schema {
  return new Schema(
    {
      companyId: { type: String, required: true, default: 'default' },
      userId: { type: Schema.Types.ObjectId, ref: 'crm_users', required: true },
      date: { type: String, required: true }, // YYYY-MM-DD
      requestedCheckIn: { type: String },     // HH:mm
      requestedCheckOut: { type: String },    // HH:mm
      selfieUrl: { type: String },
      reason: { type: String, required: true },
      status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING',
      },
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'crm_users', default: null },
      reviewedAt: { type: Date, default: null },
      reviewNote: { type: String, default: null },
    },
    { timestamps: true },
  );
}


// CRM Password Reset Schema (collection: crm_password_resets)
export function getCrmPasswordResetSchema(): Schema {
  const schema = new Schema(
    {
      email: { type: String, required: true },
      companyId: { type: String, required: true, default: 'default' },
      tokenHash: { type: String, required: true },
      expiresAt: { type: Date, required: true },
      used: { type: Boolean, default: false },
    },
    { timestamps: true },
  );
  schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-cleanup
  return schema;
}

// CRM Audit Log Schema (collection: crm_audit_logs)
export function getCrmAuditLogSchema(): Schema {
  return new Schema(
    {
      action: { type: String, required: true },
      performedBy: { type: Schema.Types.ObjectId, ref: 'crm_users', required: true },
      targetId: { type: Schema.Types.ObjectId },
      module: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
    },
    { timestamps: false },
  );
}

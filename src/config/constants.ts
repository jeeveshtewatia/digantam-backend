// User Roles
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  RM = 'rm',
  USER = 'user',
}

// Project Types
export enum ProjectType {
  INVENTORY = 'inventory',
  REAL_ESTATE = 'real_estate',
  RETAIL = 'retail',
  WAREHOUSE = 'warehouse',
  CUSTOM = 'custom',
}

// Inventory Status
export enum InventoryStatus {
  AVAILABLE = 'available',
  HOLD = 'hold',
  SOLD = 'sold',
  RESERVED = 'reserved',
  BLOCKED = 'blocked',
}

// Customer Types
export enum CustomerType {
  ENQUIRY = 'enquiry',
  BOOKING = 'booking',
  LEAD = 'lead',
}

// Default Inventory Schema Fields
export const DEFAULT_INVENTORY_SCHEMA = {
  unit_number: { type: 'String', required: true },
  unit_type: { type: 'String', required: false },
  tower: { type: 'String', required: false },
  floor: { type: 'String', required: false },
  area: { type: 'Number', required: false },
  direction: { type: 'String', required: false },
  total_cost: { type: 'Number', required: false },
  status: { type: 'String', required: true, default: 'available' },
  remarks: { type: 'String', required: false },
};

// Default Customer Schema Fields
export const DEFAULT_CUSTOMER_SCHEMA = {
  firstName: { type: 'String', required: true },
  lastName: { type: 'String', required: false },
  email: { type: 'String', required: true },
  phone: { type: 'String', required: true },
  alt_phone: { type: 'String', required: false },
  address: { type: 'String', required: false },
  unit_id: { type: 'String', required: false },
  type: { type: 'String', required: false, default: 'enquiry' },
};

// Permissions
export const PERMISSIONS = {
  // Project Management
  PROJECT_CREATE: 'project:create',
  PROJECT_READ: 'project:read',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',

  // Inventory Management
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_DELETE: 'inventory:delete',

  // Customer Management
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_READ: 'customer:read',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_DELETE: 'customer:delete',

  // Booking Management
  BOOKING_CREATE: 'booking:create',
  BOOKING_READ: 'booking:read',
  BOOKING_UPDATE: 'booking:update',
  BOOKING_DELETE: 'booking:delete',

  // User Management
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
};

// Role Permissions Mapping
export const ROLE_PERMISSIONS = {
  [UserRole.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [UserRole.ADMIN]: [
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_UPDATE,
    PERMISSIONS.CUSTOMER_DELETE,
    PERMISSIONS.BOOKING_CREATE,
    PERMISSIONS.BOOKING_READ,
    PERMISSIONS.BOOKING_UPDATE,
    PERMISSIONS.BOOKING_DELETE,
    PERMISSIONS.USER_READ,
  ],
  [UserRole.RM]: [
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_UPDATE,
    PERMISSIONS.BOOKING_CREATE,
    PERMISSIONS.BOOKING_READ,
    PERMISSIONS.BOOKING_UPDATE,
  ],
  [UserRole.USER]: [PERMISSIONS.INVENTORY_READ, PERMISSIONS.CUSTOMER_READ, PERMISSIONS.BOOKING_READ],
};

// ===========================
// CRM - Attendance Module Enums
// ===========================

export enum CrmRole {
  ADMIN = 'ADMIN',
  HR = 'HR',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  LATE = 'LATE',
  ABSENT = 'ABSENT',
  HALF_DAY = 'HALF_DAY',
  WFH = 'WFH',
  ON_LEAVE = 'ON_LEAVE',
}

export enum LeaveType {
  // Legacy types kept for backward compatibility with existing records
  CASUAL = 'CASUAL',
  SICK = 'SICK',
  EARNED = 'EARNED',
  // New unified leave type
  LEAVE = 'LEAVE',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

// Weekly off utility — global rule for all companies
// Sunday is always off. 2nd and 4th Saturday of the month are off.
export function isWeeklyOff(date: Date): boolean {
  const day = date.getDay();
  if (day === 0) return true; // Sunday always off
  if (day === 6) {
    // Which Saturday? (1st, 2nd, 3rd, 4th, 5th)
    const weekNum = Math.ceil(date.getDate() / 7);
    return weekNum === 2 || weekNum === 4; // 2nd and 4th Saturday
  }
  return false;
}

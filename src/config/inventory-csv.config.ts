export const CSV_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  UPLOAD_DIRECTORY: 'uploads/csv',
  BACKUP_DIRECTORY: 'uploads/backups', // Not used anymore (kept for backward compatibility)
  ALLOWED_MIME_TYPES: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  
  // Hybrid storage configuration
  MONGODB_RETENTION_DAYS: 15, // Keep backups in MongoDB for 15 days
  ARCHIVE_TO_S3_AFTER_DAYS: 15, // Archive to S3 after 15 days
  S3_ENABLED: process.env.AWS_S3_ENABLED === 'true', // Enable/disable S3
};

// Fields that can be updated via CSV per project
export const ALLOWED_CSV_UPDATE_FIELDS: Record<string, string[]> = {
  default: [
    'unit_number',
    'unit_type',
    'tower',
    'floor',
    'area',
    'direction',
    'total_cost',
    'status',
    'remarks',
  ],
};

export function getAllowedUpdateFields(projectId: string): string[] {
  return ALLOWED_CSV_UPDATE_FIELDS[projectId] || ALLOWED_CSV_UPDATE_FIELDS.default;
}

// Fields to exclude from CSV download (MongoDB internal fields)
export const EXCLUDED_FIELDS = ['_id', '__v'];

// Status mapping for display (optional - makes CSV more user-friendly)
export const STATUS_DISPLAY_MAP: Record<string, string> = {
  available: 'Available',
  hold: 'Reserved',
  sold: 'Sold',
  bih: 'Booking In Hand',
  blocked: 'Blocked',
};

export const STATUS_PARSE_MAP: Record<string, string> = {
  Available: 'available',
  Reserved: 'hold',
  Sold: 'sold',
  'Booking In Hand': 'bih',
  Blocked: 'blocked',
};

import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { S3Service } from '../../shared/services/s3.service';
import * as moment from 'moment-timezone';

// ─── Scope Definitions ────────────────────────────────────────────────────────

export enum AssetScope {
  // CRM-only scopes
  ATTENDANCE_SELFIE = 'attendance_selfie',
  EMPLOYEE_DOCUMENT = 'employee_document',

  // CRM + Platform user + Anonymous customer scopes
  KYC_DOCUMENT = 'kyc_document',
  BOOKING_ASSET = 'booking_asset',

  // Platform-user scopes
  PRODUCT_IMAGE = 'product_image',
  CUSTOMER_DOCUMENT = 'customer_document',

  // Fully public — no auth, no identifier required
  PUBLIC_ASSET = 'public_asset',
}

/** Which caller types are allowed per scope */
const SCOPE_ALLOWED_CALLERS: Record<AssetScope, Set<string>> = {
  [AssetScope.ATTENDANCE_SELFIE]:    new Set(['crm']),
  [AssetScope.EMPLOYEE_DOCUMENT]:    new Set(['crm']),
  [AssetScope.KYC_DOCUMENT]:         new Set(['crm', 'user', 'anonymous']),
  [AssetScope.BOOKING_ASSET]:        new Set(['crm', 'user', 'anonymous']),
  [AssetScope.PRODUCT_IMAGE]:        new Set(['crm', 'user']),
  [AssetScope.CUSTOMER_DOCUMENT]:    new Set(['crm', 'user']),
  // anonymous = completely public; no auth required
  [AssetScope.PUBLIC_ASSET]:         new Set(['crm', 'user', 'anonymous']),
};

// ─── Service DTO ──────────────────────────────────────────────────────────────

export interface GetUploadUrlDto {
  scope: AssetScope;
  fileName: string;
  fileType: string;
  /** undefined when callerType is 'anonymous' */
  callerId?: string;
  callerType: 'crm' | 'user' | 'anonymous';
  referenceId?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AssetsService {
  constructor(private readonly s3Service: S3Service) {}

  /**
   * Validates the caller's permission for the requested scope,
   * generates a hierarchical S3 key, and returns a pre-signed upload URL.
   */
  async getUploadUrl(
    dto: GetUploadUrlDto,
  ): Promise<{ uploadUrl: string; publicUrl: string; key: string; scope: AssetScope; expiresIn: number }> {
    const { scope, fileName, fileType, callerId = 'anon', callerType, referenceId } = dto;

    // Guard: validate caller is allowed for this scope
    const allowed = SCOPE_ALLOWED_CALLERS[scope];
    if (!allowed || !allowed.has(callerType)) {
      throw new ForbiddenException(
        `Caller type '${callerType}' is not permitted to upload with scope '${scope}'.`,
      );
    }

    const key = this.generateKey(scope, fileName, callerId, referenceId);

    // S3Service returns { uploadUrl, publicUrl, key }
    const { uploadUrl, publicUrl } = await this.s3Service.getPreSignedUploadUrl(key, fileType);

    return {
      uploadUrl,   // PUT to this URL to upload the file
      publicUrl,   // GET this URL after upload to access the file
      key,
      scope,
      expiresIn: 900, // matches S3Service default (15 mins)
    };
  }

  // ─── Private key builder ──────────────────────────────────────────────────

  /**
   * Generates a hierarchical, human-readable S3 key.
   *
   * Naming schema:
   *   crm/  <module>/<callerId>/[referenceId/]<timestamp>_<safeName>
   *   platform/<module>/<callerId>/[referenceId/]<timestamp>_<safeName>
   *   public/uploads/<uniquePrefix>_<safeName>
   */
  private generateKey(
    scope: AssetScope,
    fileName: string,
    callerId: string,
    referenceId?: string,
  ): string {
    const timestamp = Date.now();
    const date      = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
    const safeName  = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

    switch (scope) {
      // ── CRM-only ────────────────────────────────────────────────────────
      case AssetScope.ATTENDANCE_SELFIE:
        // One file per day per employee — deterministic key, no timestamp needed
        return `crm/attendance/selfies/${callerId}/${date}.jpg`;

      case AssetScope.EMPLOYEE_DOCUMENT:
        return `crm/employees/${callerId}/docs/${timestamp}_${safeName}`;

      // ── CRM + User + Anonymous ──────────────────────────────────────────
      case AssetScope.KYC_DOCUMENT:
        if (!referenceId) {
          throw new BadRequestException('referenceId (docType) is required for KYC.');
        }
        // If it's a customer (anon), callerId defaults to 'anon' in getUploadUrl
        // We'll use referenceId (docType) as part of the path
        return `uploads/kyc/${callerId}/${referenceId}/${timestamp}_${safeName}`;

      case AssetScope.BOOKING_ASSET:
        if (!referenceId) {
          throw new BadRequestException('referenceId (bookingId) is required for booking assets.');
        }
        // For bookings, referenceId (bookingId) is the primary identifier
        return `uploads/bookings/${referenceId}/${timestamp}_${safeName}`;

      // ── Platform-user ───────────────────────────────────────────────────
      case AssetScope.PRODUCT_IMAGE:
        return `platform/products/${referenceId ?? 'uncategorized'}/${timestamp}_${safeName}`;

      case AssetScope.CUSTOMER_DOCUMENT:
        return `platform/customers/${callerId}/docs/${timestamp}_${safeName}`;

      // ── Fully public — no auth required ──────────────────────────────────
      case AssetScope.PUBLIC_ASSET: {
        // Use a UUID prefix to prevent guessable paths
        const uniquePrefix = uuidv4();
        return `public/uploads/${uniquePrefix}_${safeName}`;
      }

      default:
        throw new BadRequestException('Invalid asset scope.');
    }
  }
}

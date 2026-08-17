import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { Public } from '../../shared/decorators/public.decorator';
import { AssetsAuthGuard } from '../../shared/guards/assets-auth.guard';
import { AssetsService, AssetScope } from './assets.service';

/**
 * Caller types for the upload endpoint.
 *
 *  - crm       → CRM employee/admin (identified via crm-jwt)
 *  - user      → Platform user / RM / Admin (identified via jwt)
 *  - anonymous → Fully open upload; no token needed
 *                (only valid for PUBLIC_ASSET or customer-facing scopes)
 */
type CallerType = 'crm' | 'user' | 'anonymous';

@ApiTags('Assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) { }

  /**
   * GET /assets/upload-url
   *
   * Returns a pre-signed S3 URL for a direct browser-upload.
   *
   * Supports optional authentication using AssetsAuthGuard (checks crm-jwt and jwt).
   * marked with @Public() so anonymous users can access it for specific scopes.
   */
  @Get('upload-url')
  @Public()
  @UseGuards(AssetsAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get a pre-signed S3 URL for direct upload',
    description: `
Supports three caller categories:
- **CRM users** (crm-jwt token) — can use all CRM scopes.
- **Platform users** (jwt token) — can use platform scopes.
- **Anonymous / public** (no token) — valid for customer-facing scopes like \`booking_asset\` and \`public_asset\`.
    `,
  })
  @ApiQuery({ name: 'scope', enum: AssetScope, required: true })
  @ApiQuery({ name: 'fileName', required: true })
  @ApiQuery({ name: 'fileType', required: true, example: 'image/jpeg' })
  @ApiQuery({
    name: 'referenceId',
    required: false,
    description: 'Context ID: bookingId for BOOKING_ASSET, docType for KYC, etc.',
  })
  @ApiResponse({ status: 200, description: 'Pre-signed upload URL returned.' })
  @ApiResponse({ status: 400, description: 'Missing / invalid parameters.' })
  @ApiResponse({ status: 401, description: 'Unauthenticated.' })
  async getUploadUrl(
    @Query('scope') scope: AssetScope,
    @Query('fileName') fileName: string,
    @Query('fileType') fileType: string,
    @Query('referenceId') referenceId: string,
    @Req() req: any,
  ) {
    if (!scope || !fileName || !fileType) {
      throw new BadRequestException('scope, fileName and fileType are required.');
    }

    const { callerId, callerType } = this.resolveCallerIdentity(req);

    return this.assetsService.getUploadUrl({
      scope,
      fileName,
      fileType,
      callerId,
      callerType,
      referenceId,
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Resolves who is making the upload request and returns a stable
   * `callerId` string plus a `callerType` tag used for S3 key routing.
   */
  private resolveCallerIdentity(
    req: any,
  ): { callerId?: string; callerType: CallerType } {
    // 1. CRM employee / admin (req.user becomes req.crmUser via Passport)
    if (req.crmUser?._id) {
      return { callerId: req.crmUser._id.toString(), callerType: 'crm' };
    }

    // 2. Authenticated platform user (jwt)
    if (req.user?._id) {
      return { callerId: req.user._id.toString(), callerType: 'user' };
    }

    // 3. Fully anonymous — service will enforce scope-based guards
    return { callerId: undefined, callerType: 'anonymous' };
  }
}

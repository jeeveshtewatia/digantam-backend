import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { InventoriesService } from './inventories.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { ProjectValidationGuard } from '../../shared/guards/project-validation.guard';
import { ProjectAuthGuard } from '../../shared/guards/project-auth.guard';
import { RequirePermissions } from '../../shared/decorators/permissions.decorator';
import { ProjectId } from '../../shared/decorators/project-id.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { PERMISSIONS } from '../../config/constants';
import { CSV_CONFIG } from '../../config/inventory-csv.config';
import * as path from 'path';
import { nanoid } from 'nanoid';

@ApiTags('Inventories')
@Controller('inventories')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, ProjectValidationGuard, ProjectAuthGuard)
export class InventoriesController {
  constructor(private inventoriesService: InventoriesService) {}

  @Post(':projectId')
  @RequirePermissions(PERMISSIONS.INVENTORY_CREATE)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({ summary: 'Create inventory item (Admin only)' })
  @ApiResponse({ status: 201, description: 'Inventory created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async create(@ProjectId() projectId: string, @Body() createInventoryDto: CreateInventoryDto) {
    return this.inventoriesService.create(projectId, createInventoryDto);
  }

  @Post(':projectId/bulk')
  @RequirePermissions(PERMISSIONS.INVENTORY_CREATE)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({ summary: 'Bulk create inventory items (Admin only)' })
  @ApiResponse({ status: 201, description: 'Inventories created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async bulkCreate(@ProjectId() projectId: string, @Body() inventories: CreateInventoryDto[]) {
    return this.inventoriesService.bulkCreate(projectId, inventories);
  }

  @Get(':projectId')
  @Public()
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({ summary: 'Get all inventories for a project' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'tower', required: false, type: String })
  @ApiQuery({ name: 'floor', required: false, type: String })
  @ApiQuery({ name: 'unit_type', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Inventories retrieved successfully' })
  async findAll(@ProjectId() projectId: string, @Query() filters: any) {
    return this.inventoriesService.findAll(projectId, filters);
  }

  @Get(':projectId/tower-stats')
  @Public()
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({
    summary: 'Get tower-wise statistics',
    description:
      'Returns aggregated statistics for each tower: floor count, total flats, unit types, min/max area. All calculations done on server using MongoDB aggregation for optimal performance.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tower statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Tower statistics retrieved successfully' },
        count: { type: 'number', example: 3, description: 'Number of towers' },
        towers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tower: { type: 'string', example: 'A', description: 'Tower name' },
              floors: { type: 'number', example: 21, description: 'Number of unique floors' },
              totalFlats: { type: 'number', example: 50, description: 'Total number of flats in tower' },
              unitTypes: {
                type: 'array',
                items: { type: 'string' },
                example: ['2BHK', '3BHK'],
                description: 'Unique unit types in tower',
              },
              minArea: { type: 'number', example: 1200, nullable: true, description: 'Minimum area in sq ft' },
              maxArea: { type: 'number', example: 2500, nullable: true, description: 'Maximum area in sq ft' },
            },
          },
        },
      },
    },
  })
  async getTowerStatistics(@ProjectId() projectId: string) {
    return this.inventoriesService.getTowerStatistics(projectId);
  }

  @Get(':projectId/:id')
  @Public()
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiParam({ name: 'id', description: 'Inventory ID', type: String, example: 'abc123xyz' })
  @ApiOperation({ summary: 'Get inventory by ID' })
  @ApiResponse({ status: 200, description: 'Inventory retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Inventory not found' })
  async findOne(@ProjectId() projectId: string, @Param('id') id: string) {
    return this.inventoriesService.findOne(projectId, id);
  }

  @Put(':projectId/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_UPDATE)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiParam({ name: 'id', description: 'Inventory ID', type: String, example: 'abc123xyz' })
  @ApiOperation({ summary: 'Update inventory (Admin only)' })
  @ApiResponse({ status: 200, description: 'Inventory updated successfully' })
  @ApiResponse({ status: 404, description: 'Inventory not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async update(
    @ProjectId() projectId: string,
    @Param('id') id: string,
    @Body() updateInventoryDto: UpdateInventoryDto,
  ) {
    return this.inventoriesService.update(projectId, id, updateInventoryDto);
  }

  @Delete(':projectId/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_DELETE)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiParam({ name: 'id', description: 'Inventory ID', type: String, example: 'abc123xyz' })
  @ApiOperation({ summary: 'Delete inventory (Admin only)' })
  @ApiResponse({ status: 200, description: 'Inventory deleted successfully' })
  @ApiResponse({ status: 404, description: 'Inventory not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async delete(@ProjectId() projectId: string, @Param('id') id: string) {
    return this.inventoriesService.delete(projectId, id);
  }

  // ==================== CSV Operations ====================

  @Get(':projectId/csv/download')
  @Public()
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({
    summary: 'Download inventory data as CSV',
    description: 'Downloads all inventory data for a project in CSV format. Can be edited and re-uploaded.',
  })
  @ApiResponse({ status: 200, description: 'CSV file downloaded successfully' })
  @ApiResponse({ status: 404, description: 'No inventory data found' })
  async downloadCSV(@ProjectId() projectId: string, @Res() res: Response) {
    const csvData = await this.inventoriesService.downloadInventoryCSV(projectId);

    const filename = `inventory_${projectId}_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
  }

  @Get(':projectId/csv/template')
  @Public()
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({
    summary: 'Download CSV template',
    description: 'Downloads a CSV template with headers and sample data for updating inventories.',
  })
  @ApiResponse({ status: 200, description: 'CSV template downloaded successfully' })
  async downloadTemplate(@ProjectId() projectId: string, @Res() res: Response) {
    const csvTemplate = await this.inventoriesService.getCSVTemplate(projectId);

    const filename = `inventory_template_${projectId}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvTemplate);
  }

  @Post(':projectId/csv/upload')
  @RequirePermissions(PERMISSIONS.INVENTORY_UPDATE)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({
    summary: 'Upload CSV to update inventories (Admin only)',
    description:
      'Upload a CSV file to bulk update inventory data. Creates a backup before applying changes. Only allowed fields will be updated.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'CSV processed and inventories updated' })
  @ApiResponse({ status: 400, description: 'Invalid CSV file or format' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: CSV_CONFIG.UPLOAD_DIRECTORY,
        filename: (req, file, cb) => {
          const uniqueName = `${nanoid(10)}_${Date.now()}${path.extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!CSV_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(new BadRequestException('Only CSV files are allowed'), false);
        } else {
          cb(null, true);
        }
      },
      limits: {
        fileSize: CSV_CONFIG.MAX_FILE_SIZE,
      },
    }),
  )
  async uploadCSV(
    @ProjectId() projectId: string,
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.inventoriesService.updateInventoryFromCSV(projectId, file.path, user);
  }

  @Get(':projectId/csv/history')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({
    summary: 'Get CSV update history',
    description: 'Returns history of CSV uploads and rollbacks with backup information.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of records to return (default: 20)' })
  @ApiResponse({ status: 200, description: 'History retrieved successfully' })
  async getCSVHistory(@ProjectId() projectId: string, @Query('limit') limit?: number) {
    return this.inventoriesService.getCSVHistory(projectId, limit || 20);
  }

  @Post(':projectId/csv/rollback/:historyId')
  @RequirePermissions(PERMISSIONS.INVENTORY_UPDATE)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiParam({ name: 'historyId', description: 'History ID to rollback to', type: String, example: 'hist_abc123' })
  @ApiOperation({
    summary: 'Rollback to a previous backup (Admin only)',
    description:
      'Restores inventory data from a previous backup (MongoDB or S3). Creates a new backup of current state before rollback.',
  })
  @ApiResponse({ status: 200, description: 'Rollback completed successfully' })
  @ApiResponse({ status: 404, description: 'Backup not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async rollback(
    @ProjectId() projectId: string,
    @Param('historyId') historyId: string,
    @CurrentUser() user: any,
  ) {
    return this.inventoriesService.rollbackFromBackup(projectId, historyId, user);
  }

  // ==================== Archive Management ====================

  @Post(':projectId/csv/archive')
  @RequirePermissions(PERMISSIONS.INVENTORY_UPDATE)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({
    summary: 'Archive old backups to S3 (Admin only)',
    description:
      'Moves backups older than 15 days from MongoDB to S3. Reduces MongoDB storage costs while keeping backups accessible.',
  })
  @ApiResponse({ status: 200, description: 'Backups archived successfully' })
  @ApiResponse({ status: 400, description: 'S3 not enabled' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async archiveBackups(@ProjectId() projectId: string) {
    return this.inventoriesService.archiveOldBackups(projectId);
  }

  @Get(':projectId/csv/archive-stats')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({
    summary: 'Get backup archive statistics',
    description: 'Returns statistics about backup storage (MongoDB vs S3)',
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getArchiveStats(@ProjectId() projectId: string) {
    return this.inventoriesService.getArchiveStats(projectId);
  }
}

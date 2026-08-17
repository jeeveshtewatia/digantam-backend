import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import {
  getAllowedUpdateFields,
  EXCLUDED_FIELDS,
  STATUS_DISPLAY_MAP,
  STATUS_PARSE_MAP,
  CSV_CONFIG,
} from '../../config/inventory-csv.config';
import { S3Service } from '../../shared/services/s3.service';
import { CommonUtilsService } from '../../shared/services/common-utils.service';
import { CsvService } from '../../shared/services/csv.service';
import * as fs from 'fs';

@Injectable()
export class InventoriesService {
  private readonly logger = new Logger(InventoriesService.name);

  constructor(
    private projectsUtilsService: ProjectsUtilsService,
    private s3Service: S3Service,
    private commonUtilsService: CommonUtilsService,
    private csvService: CsvService,
  ) {}

  async create(projectId: string, createInventoryDto: CreateInventoryDto) {
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    // Use provided id or generate one
    const id = createInventoryDto.id || this.commonUtilsService.generateId(10);

    // If custom id is provided, check if it already exists
    if (createInventoryDto.id) {
      const existingInventory = await InventoryModel.findOne({
        id: createInventoryDto.id,
        project_id: projectId,
      });

      if (existingInventory) {
        throw new ConflictException(`Inventory with ID '${createInventoryDto.id}' already exists`);
      }
    }

    // Remove id from DTO to avoid duplicate in create
    const { id: _, ...inventoryData } = createInventoryDto;

    // Create inventory
    const inventory = await InventoryModel.create({
      ...inventoryData,
      id,
      project_id: projectId,
    });

    return {
      message: 'Inventory created successfully',
      inventory,
    };
  }

  async findAll(projectId: string, filters?: any) {
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    const query: any = { project_id: projectId };

    // Apply filters
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.tower) {
      query.tower = filters.tower;
    }
    if (filters?.floor) {
      query.floor = filters.floor;
    }
    if (filters?.unit_type) {
      query.unit_type = filters.unit_type;
    }

    const inventories = await InventoryModel.find(query).sort({ createdAt: -1 });

    return {
      count: inventories.length,
      inventories,
    };
  }

  async findOne(projectId: string, id: string) {
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);
    const inventory = await InventoryModel.findOne({ id, project_id: projectId });

    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    return inventory;
  }

  /**
   * Get tower-wise statistics (aggregated on server)
   * Returns: tower name, floor count, total flats, unit types, min/max area
   * All calculations done on server using MongoDB aggregation pipeline
   */
  async getTowerStatistics(projectId: string) {
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    // MongoDB aggregation pipeline for efficient server-side calculation
    const pipeline: any[] = [
      // Match only inventories for this project with valid tower
      {
        $match: {
          project_id: projectId,
          $and: [
            { tower: { $exists: true } },
            { tower: { $ne: null } },
            { tower: { $ne: '' } },
          ],
        },
      },
      // Group by tower
      {
        $group: {
          _id: '$tower',
          floors: { $addToSet: '$floor' }, // Unique floors array
          totalFlats: { $sum: 1 }, // Count of flats
          unitTypes: { $addToSet: '$unit_type' }, // Unique unit types
          areas: {
            $push: {
              $cond: [{ $ne: ['$area', null] }, '$area', '$$REMOVE'],
            },
          },
        },
      },
      // Project and calculate final values
      {
        $project: {
          _id: 0,
          tower: '$_id',
          floors: {
            $size: {
              $filter: {
                input: '$floors',
                as: 'floor',
                cond: { $and: [{ $ne: ['$$floor', null] }, { $ne: ['$$floor', ''] }] },
              },
            },
          },
          totalFlats: 1,
          unitTypes: {
            $filter: {
              input: '$unitTypes',
              as: 'type',
              cond: { $and: [{ $ne: ['$$type', null] }, { $ne: ['$$type', ''] }] },
            },
          },
          minArea: {
            $cond: [
              { $gt: [{ $size: '$areas' }, 0] },
              { $min: '$areas' },
              null,
            ],
          },
          maxArea: {
            $cond: [
              { $gt: [{ $size: '$areas' }, 0] },
              { $max: '$areas' },
              null,
            ],
          },
        },
      },
      // Sort by tower name
      {
        $sort: { tower: 1 as 1 },
      },
    ];

    const towerStats = await InventoryModel.aggregate(pipeline);

    return {
      message: 'Tower statistics retrieved successfully',
      count: towerStats.length,
      towers: towerStats,
    };
  }

  async update(projectId: string, id: string, updateInventoryDto: UpdateInventoryDto) {
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    // Explicitly exclude 'id' from update (id is immutable after creation)
    const { id: _, ...updateData } = updateInventoryDto as any;
    
    // Ensure id is not in updateData (double check)
    delete updateData.id;

    const inventory = await InventoryModel.findOneAndUpdate(
      { id, project_id: projectId },
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    return {
      message: 'Inventory updated successfully',
      inventory,
    };
  }

  async delete(projectId: string, id: string) {
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    const inventory = await InventoryModel.findOneAndDelete({ id, project_id: projectId });

    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    return {
      message: 'Inventory deleted successfully',
    };
  }

  async bulkCreate(projectId: string, inventories: CreateInventoryDto[]) {
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    // Check for duplicate IDs in the request (only for provided custom IDs)
    const providedIds = inventories
      .map((inv) => inv.id)
      .filter((id) => id !== undefined && id !== null);
    
    if (providedIds.length > 0) {
      const duplicateIds = providedIds.filter((id, index) => providedIds.indexOf(id) !== index);
      
      if (duplicateIds.length > 0) {
        throw new ConflictException(
          `Duplicate IDs found in request: ${duplicateIds.join(', ')}`
        );
      }

      // Check for existing IDs in database
      const existingInventories = await InventoryModel.find({
        id: { $in: providedIds },
        project_id: projectId,
      });

      if (existingInventories.length > 0) {
        const existingIds = existingInventories.map((inv) => inv.id);
        throw new ConflictException(
          `Inventories with these IDs already exist: ${existingIds.join(', ')}`
        );
      }
    }

    // Use provided id or generate one for each inventory
    const inventoriesWithIds = inventories.map((inv) => {
      const { id: customId, ...inventoryData } = inv;
      return {
        ...inventoryData,
        id: customId || this.commonUtilsService.generateId(10), 
        project_id: projectId,
      };
    });

    const createdInventories = await InventoryModel.insertMany(inventoriesWithIds);

    return {
      message: 'Inventories created successfully',
      count: createdInventories.length,
      inventories: createdInventories,
    };
  }

  /**
   * Download all inventories as CSV
   */
  async downloadInventoryCSV(projectId: string): Promise<string> {
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    // Fetch all inventories
    const inventories = await InventoryModel.find({ project_id: projectId }).lean().exec();

    if (inventories.length === 0) {
      throw new NotFoundException('No inventory data found for this project');
    }

    // Remove excluded fields and convert status to display format
    const cleanedInventories = inventories.map((inv: any) => {
      const cleaned = { ...inv };
      EXCLUDED_FIELDS.forEach((field) => delete cleaned[field]);

      // Convert status to display format (optional)
      if (cleaned.status && STATUS_DISPLAY_MAP[cleaned.status]) {
        cleaned.status = STATUS_DISPLAY_MAP[cleaned.status];
      }

      return cleaned;
    });

    // Get field names from first inventory
    const fields = Object.keys(cleanedInventories[0]);

    // Convert to CSV using shared CsvService
    return this.csvService.jsonToCsv(cleanedInventories, fields);
  }

  /**
   * Update inventories from CSV file with backup
   */
  async updateInventoryFromCSV(projectId: string, filePath: string, user: any) {
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);
    const CSVHistoryModel = this.projectsUtilsService.getCSVHistoryModel();

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new BadRequestException('Uploaded file not found');
      }

      // Parse CSV to JSON using shared CsvService
      const records = await this.csvService.parseFile(filePath);

      if (records.length === 0) {
        throw new BadRequestException('CSV file is empty');
      }

      // Validate CSV has 'id' column
      if (!records[0].hasOwnProperty('id')) {
        throw new BadRequestException('CSV must contain an "id" column');
      }

      // Create backup before making changes
      const backupData = await this.createBackup(projectId);

      // Get allowed fields for this project
      const allowedFields = getAllowedUpdateFields(projectId);

      const updateResults = {
        total: records.length,
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [] as string[],
        allowedFields: allowedFields,
      };

      // Collect bulk operations
      const bulkOps: any[] = [];
      const indexToRow = new Map<number, number>();

      // Process each record to build bulk operations
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNumber = i + 2; 
        const inventoryId = record.id?.trim();

        if (!inventoryId) {
          updateResults.skipped++;
          updateResults.errors.push(`Row ${rowNumber}: Missing or empty ID field`);
          continue;
        }

        try {
          const updateData: any = {};
          let hasChanges = false;

          for (const key of allowedFields) {
            if (key === 'id') continue;

            if (record[key] !== undefined && record[key] !== null) {
              let value = record[key];
              if (typeof value === 'string') value = value.trim();

              if (key === 'status' && STATUS_PARSE_MAP[value]) {
                value = STATUS_PARSE_MAP[value];
              }

              if (['area', 'total_cost'].includes(key) && value !== '') {
                const numValue = Number(value);
                if (!isNaN(numValue)) value = numValue;
              }

              if (value !== '') {
                updateData[key] = value;
                hasChanges = true;
              }
            }
          }

          if (!hasChanges) {
            updateResults.skipped++;
            continue;
          }

          // Add to bulk operations
          indexToRow.set(bulkOps.length, rowNumber);
          bulkOps.push({
            updateOne: {
              filter: { id: inventoryId, project_id: projectId },
              update: { $set: updateData },
            },
          });
        } catch (error) {
          updateResults.failed++;
          updateResults.errors.push(`Row ${rowNumber}: ${error.message}`);
        }
      }

      // Execute bulk operations in chunks of 1000
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < bulkOps.length; i += CHUNK_SIZE) {
        const chunk = bulkOps.slice(i, i + CHUNK_SIZE);
        try {
          const result = await InventoryModel.bulkWrite(chunk, { ordered: false });
          
          updateResults.success += result.modifiedCount;
          updateResults.skipped += (result.matchedCount - result.modifiedCount);
          
          // Check for unmatched documents in this chunk
          if (result.matchedCount < chunk.length) {
            const unmatchedInChunk = chunk.length - result.matchedCount;
            updateResults.failed += unmatchedInChunk;
            // No need for separate error message per chunk, we'll summarize at the end
          }
        } catch (error: any) {
          if (error.writeErrors) {
            updateResults.failed += error.writeErrors.length;
            error.writeErrors.forEach((err: any) => {
              // Adjust index relative to the entire bulkOps array
              const globalIndex = i + err.index;
              const rowNum = indexToRow.get(globalIndex);
              updateResults.errors.push(`Row ${rowNum}: ${err.errmsg}`);
            });
            updateResults.success += error.nModified || 0;
          } else {
            this.logger.error(`Bulk write error at chunk ${i}: ${error.message}`);
          }
        }
      }

      // Final failure check for IDs not found
      if (updateResults.failed > 0 && updateResults.errors.length < updateResults.failed) {
        const missingIds = updateResults.failed - updateResults.errors.length;
        if (missingIds > 0) {
          updateResults.errors.push(`${missingIds} records were skipped because their IDs were not found in the database.`);
        }
      }

      // Save history record with backup in MongoDB
      await CSVHistoryModel.create({
        id: this.commonUtilsService.generateId(10),
        project_id: projectId,
        action: 'CSV Upload',
        user: {
          id: user._id?.toString() || user.id,
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          role: user.role,
        },
        storage_type: 'mongodb', // Initially stored in MongoDB
        backup_data: backupData.data, // CSV content stored directly
        backup_filename: backupData.filename,
        backup_size: backupData.size,
        backup_record_count: backupData.recordCount,
        changes: {
          total: updateResults.total,
          success: updateResults.success,
          failed: updateResults.failed,
          skipped: updateResults.skipped,
        },
        errors: updateResults.errors,
        timestamp: new Date(),
        archive_status: 'active',
      });

      this.logger.log(`📊 CSV upload completed: ${updateResults.success}/${updateResults.total} records updated`);

      return {
        message: 'CSV processing completed',
        ...updateResults,
        backup: {
          filename: backupData.filename,
          size: backupData.size,
          recordCount: backupData.recordCount,
          storage: 'mongodb',
        },
      };
    } finally {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error('Failed to delete uploaded file:', error);
        }
      }
    }
  }

  /**
   * Create backup of current inventory data (stores in MongoDB)
   * Hybrid approach: MongoDB for recent (15 days), will be archived to S3 later
   */
  private async createBackup(projectId: string): Promise<{
    data: string;
    filename: string;
    size: number;
    recordCount: number;
  }> {
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    // Fetch all current inventories
    const inventories = await InventoryModel.find({ project_id: projectId }).lean().exec();

    if (inventories.length === 0) {
      throw new NotFoundException('No inventory data to backup');
    }

    // Convert to CSV using shared CsvService
    const csvData = this.csvService.jsonToCsv(inventories);

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${projectId}_${timestamp}.csv`;

    this.logger.log(`✅ Created backup for ${projectId}: ${filename} (${inventories.length} records)`);

    return {
      data: csvData, // Store CSV content directly
      filename: filename,
      size: Buffer.byteLength(csvData, 'utf8'),
      recordCount: inventories.length,
    };
  }

  /**
   * Get CSV template with headers
   */
  async getCSVTemplate(projectId: string): Promise<string> {
    // Verify project exists
    await this.projectsUtilsService.isValidProjectId(projectId);

    // Get allowed fields for this project
    const allowedFields = getAllowedUpdateFields(projectId);

    // Create template with 'id' first, then other fields
    const fields = ['id', 'project_id', ...allowedFields.filter((f) => f !== 'id')];

    // Create sample row with placeholders
    const sampleData = fields.reduce((acc, field) => {
      if (field === 'id') {
        acc[field] = 'unit_001';
      } else if (field === 'project_id') {
        acc[field] = projectId;
      } else if (field === 'status') {
        acc[field] = 'Available';
      } else {
        acc[field] = `[${field}]`;
      }
      return acc;
    }, {} as Record<string, string>);

    const csvTemplate = this.csvService.jsonToCsv([sampleData], fields);

    return csvTemplate;
  }

  /**
   * Get CSV update history
   */
  async getCSVHistory(projectId: string, limit: number = 20) {
    const CSVHistoryModel = this.projectsUtilsService.getCSVHistoryModel();

    const history = await CSVHistoryModel.find({ project_id: projectId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
      .exec();

    return history;
  }

  /**
   * Rollback to a previous backup (supports hybrid storage)
   */
  async rollbackFromBackup(projectId: string, historyId: string, user: any) {
    const CSVHistoryModel = this.projectsUtilsService.getCSVHistoryModel();
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);

    // Find history record
    const historyRecord = await CSVHistoryModel.findOne({ id: historyId, project_id: projectId });

    if (!historyRecord) {
      throw new NotFoundException('Backup history not found');
    }

    // Get backup data from MongoDB or S3
    let csvData: string;

    if (historyRecord.storage_type === 'mongodb' || historyRecord.storage_type === 'both') {
      // Get from MongoDB
      if (!historyRecord.backup_data) {
        throw new NotFoundException('Backup data not found in MongoDB');
      }
      csvData = historyRecord.backup_data;
      this.logger.log(`📥 Loading backup from MongoDB: ${historyRecord.backup_filename}`);
    } else if (historyRecord.storage_type === 's3') {
      // Get from S3
      if (!historyRecord.backup_s3_key) {
        throw new NotFoundException('Backup S3 key not found');
      }
      this.logger.log(`📥 Loading backup from S3: ${historyRecord.backup_s3_key}`);
      csvData = await this.s3Service.downloadBackup(historyRecord.backup_s3_key);
    } else {
      throw new NotFoundException('Backup storage type unknown or data not available');
    }

    // Create backup of current state before rollback
    const currentBackup = await this.createBackup(projectId);

    // Parse backup CSV from string using shared CsvService
    const backupRecords = await this.csvService.parseString(csvData);

    if (backupRecords.length === 0) {
      throw new BadRequestException('Backup file is empty');
    }

    const rollbackResults = {
      total: backupRecords.length,
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Restore each record from backup
    for (let i = 0; i < backupRecords.length; i++) {
      const record = backupRecords[i];
      const inventoryId = record.id;

      if (!inventoryId) {
        rollbackResults.failed++;
        rollbackResults.errors.push(`Row ${i + 1}: Missing ID`);
        continue;
      }

      try {
        // Remove MongoDB specific fields
        const { _id, __v, ...restoreData } = record;

        // Upsert (update or insert) to restore exact state
        const result = await InventoryModel.updateOne(
          { id: inventoryId, project_id: projectId },
          { $set: restoreData },
          { upsert: false }, // Don't create new records, only update existing
        );

        if (result.matchedCount > 0) {
          rollbackResults.success++;
        } else {
          rollbackResults.failed++;
          rollbackResults.errors.push(`Row ${i + 1}: Inventory ID ${inventoryId} not found`);
        }
      } catch (error) {
        rollbackResults.failed++;
        rollbackResults.errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    // Save rollback history with current state backup in MongoDB
    await CSVHistoryModel.create({
      id: this.commonUtilsService.generateId(10),
      project_id: projectId,
      action: 'Rollback',
      user: {
        id: user._id?.toString() || user.id,
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        role: user.role,
      },
      storage_type: 'mongodb',
      backup_data: currentBackup.data,
      backup_filename: currentBackup.filename,
      backup_size: currentBackup.size,
      backup_record_count: currentBackup.recordCount,
      changes: {
        total: rollbackResults.total,
        success: rollbackResults.success,
        failed: rollbackResults.failed,
        skipped: 0,
      },
      errors: rollbackResults.errors,
      timestamp: new Date(),
      archive_status: 'active',
    });

    this.logger.log(`♻️  Rollback completed: ${rollbackResults.success}/${rollbackResults.total} records restored`);

    return {
      message: 'Rollback completed successfully',
      rolledBackFrom: historyRecord.timestamp,
      rolledBackStorage: historyRecord.storage_type,
      ...rollbackResults,
      currentBackup: {
        filename: currentBackup.filename,
        size: currentBackup.size,
        recordCount: currentBackup.recordCount,
        storage: 'mongodb',
      },
    };
  }

  /**
   * Archive old backups from MongoDB to S3 (15+ days old)
   * This helps reduce MongoDB storage and moves cold data to cheaper S3 storage
   */
  async archiveOldBackups(projectId?: string): Promise<{
    message: string;
    archived: number;
    failed: number;
    errors: string[];
  }> {
    const CSVHistoryModel = this.projectsUtilsService.getCSVHistoryModel();

    if (!this.s3Service.isEnabled()) {
      throw new BadRequestException('S3 storage is not enabled. Cannot archive backups.');
    }

    // Find backups older than 15 days in MongoDB
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CSV_CONFIG.MONGODB_RETENTION_DAYS);

    const query: any = {
      timestamp: { $lt: cutoffDate },
      storage_type: 'mongodb',
      archive_status: 'active',
      backup_data: { $exists: true },
    };

    if (projectId) {
      query.project_id = projectId;
    }

    const oldBackups = await CSVHistoryModel.find(query).exec();

    const results = {
      archived: 0,
      failed: 0,
      errors: [] as string[],
    };

    this.logger.log(`🔄 Archiving ${oldBackups.length} old backups to S3...`);

    for (const backup of oldBackups) {
      try {
        // Generate S3 key
        const s3Key = this.s3Service.generateBackupKey(backup.project_id, backup.backup_filename);

        // Upload to S3
        await this.s3Service.uploadBackup(s3Key, backup.backup_data);

        // Update history record
        await CSVHistoryModel.updateOne(
          { _id: backup._id },
          {
            $set: {
              storage_type: 's3',
              backup_s3_key: s3Key,
              backup_s3_bucket: this.s3Service['bucket'],
              archived_at: new Date(),
              archive_status: 'archived',
            },
            $unset: { backup_data: '' }, // Remove CSV data from MongoDB
          },
        );

        results.archived++;
        this.logger.log(`✅ Archived: ${backup.backup_filename} → ${s3Key}`);
      } catch (error) {
        results.failed++;
        results.errors.push(`${backup.backup_filename}: ${error.message}`);
        this.logger.error(`❌ Failed to archive ${backup.backup_filename}: ${error.message}`);

        // Mark as failed
        await CSVHistoryModel.updateOne(
          { _id: backup._id },
          { $set: { archive_status: 'failed' } },
        );
      }
    }

    const message = `Archived ${results.archived} backups to S3${
      results.failed > 0 ? `, ${results.failed} failed` : ''
    }`;
    this.logger.log(`📦 ${message}`);

    return {
      message,
      ...results,
    };
  }

  /**
   * Get archive statistics
   */
  async getArchiveStats(projectId?: string) {
    const CSVHistoryModel = this.projectsUtilsService.getCSVHistoryModel();

    const query: any = {};
    if (projectId) {
      query.project_id = projectId;
    }

    const [totalBackups, mongoBackups, s3Backups, failedBackups] = await Promise.all([
      CSVHistoryModel.countDocuments(query),
      CSVHistoryModel.countDocuments({ ...query, storage_type: 'mongodb' }),
      CSVHistoryModel.countDocuments({ ...query, storage_type: 's3' }),
      CSVHistoryModel.countDocuments({ ...query, archive_status: 'failed' }),
    ]);

    // Calculate size in MongoDB
    const mongoBackupsData = await CSVHistoryModel.find({
      ...query,
      storage_type: 'mongodb',
      backup_size: { $exists: true },
    }).select('backup_size');

    const totalMongoSize = mongoBackupsData.reduce((sum, backup) => sum + (backup.backup_size || 0), 0);

    return {
      total: totalBackups,
      mongodb: mongoBackups,
      s3: s3Backups,
      failed: failedBackups,
      mongodbSizeBytes: totalMongoSize,
      mongodbSizeMB: (totalMongoSize / (1024 * 1024)).toFixed(2),
      s3Enabled: this.s3Service.isEnabled(),
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3Client: S3Client | null = null;
  private backupBucket: string;
  private assetsBucket: string;
  private enabled: boolean;

  constructor(private configService: ConfigService) {
    this.backupBucket = this.configService.get<string>('AWS_S3_BACKUP_BUCKET', 'sketchers3d-backups');
    this.assetsBucket = this.configService.get<string>('AWS_S3_ASSETS_BUCKET', 'sketchers3d-assets');
    this.enabled = this.configService.get<string>('AWS_S3_ENABLED', 'false') === 'true';

    if (this.enabled) {
      this.initializeS3Client();
    } else {
      this.logger.warn('S3 backup storage is disabled. Set AWS_S3_ENABLED=true to enable.');
    }
  }

  private initializeS3Client() {
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID', 'DUMMY_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY', 'DUMMY_SECRET_KEY');
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');

    if (accessKeyId === 'DUMMY_ACCESS_KEY' || secretAccessKey === 'DUMMY_SECRET_KEY') {
      this.logger.warn('⚠️  Using DUMMY AWS credentials. Update .env with real credentials for production.');
    }

    try {
      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log(`✅ S3 client initialized. Backups: ${this.backupBucket}, Assets: ${this.assetsBucket}`);
    } catch (error) {
      this.logger.error('❌ Failed to initialize S3 client:', error.message);
      this.enabled = false;
    }
  }

  /**
   * Check if S3 is enabled and configured
   */
  isEnabled(): boolean {
    return this.enabled && this.s3Client !== null;
  }

  /**
   * Upload CSV backup to S3
   */
  async uploadBackup(key: string, csvData: string): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('S3 storage is not enabled. Enable it in configuration.');
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.backupBucket,
        Key: key,
        Body: csvData,
        ContentType: 'text/csv',
        Metadata: {
          uploadedAt: new Date().toISOString(),
          source: 'sketchers-backend',
        },
      });

      await this.s3Client.send(command);
      const s3Url = `s3://${this.backupBucket}/${key}`;
      this.logger.log(`✅ Backup uploaded to S3: ${s3Url}`);
      return s3Url;
    } catch (error) {
      this.logger.error(`❌ Failed to upload backup to S3: ${error.message}`);
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Generate a pre-signed URL for direct frontend upload
   * @param key S3 Object Key
   * @param contentType MIME type of the file
   * @param expiresIn Expiration time in seconds (default 15 mins)
   */
  async getPreSignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 900,
  ): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
    if (!this.isEnabled()) {
      throw new Error('S3 storage is not enabled.');
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.assetsBucket,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

      const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
      const publicUrl = `https://${this.assetsBucket}.s3.${region}.amazonaws.com/${key}`;

      return { uploadUrl, publicUrl, key };
    } catch (error) {
      this.logger.error(`❌ Failed to generate signed URL: ${error.message}`);
      throw new Error(`S3 signed URL generation failed: ${error.message}`);
    }
  }

  /**
   * Download CSV backup from S3
   */
  async downloadBackup(key: string): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('S3 storage is not enabled. Enable it in configuration.');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.backupBucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const csvData = await response.Body.transformToString();
      this.logger.log(`✅ Backup downloaded from S3: ${key}`);
      return csvData;
    } catch (error) {
      this.logger.error(`❌ Failed to download backup from S3: ${error.message}`);
      throw new Error(`S3 download failed: ${error.message}`);
    }
  }

  /**
   * Delete CSV backup from S3
   */
  async deleteBackup(key: string): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('S3 storage is not enabled. Enable it in configuration.');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.backupBucket,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`✅ Backup deleted from S3: ${key}`);
    } catch (error) {
      this.logger.error(`❌ Failed to delete backup from S3: ${error.message}`);
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  /**
   * Generate S3 key for backup
   * Format: backups/{projectId}/{year}/{month}/{filename}
   */
  generateBackupKey(projectId: string, filename: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `backups/${projectId}/${year}/${month}/${filename}`;
  }

  /**
   * Test S3 connection (useful for debugging)
   */
  async testConnection(): Promise<{ success: boolean; message: string; bucket?: string }> {
    if (!this.isEnabled()) {
      return {
        success: false,
        message: 'S3 is not enabled. Set AWS_S3_ENABLED=true in .env',
      };
    }

    try {
      // Try to upload a test file
      const testKey = 'test-connection.txt';
      const testCommand = new PutObjectCommand({
        Bucket: this.backupBucket,
        Key: testKey,
        Body: 'Connection test',
      });

      await this.s3Client.send(testCommand);

      // Clean up test file
      await this.deleteBackup(testKey);

      return {
        success: true,
        message: 'S3 connection successful',
        bucket: this.backupBucket,
      };
    } catch (error) {
      return {
        success: false,
        message: `S3 connection failed: ${error.message}`,
      };
    }
  }
}

import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { InventoriesController } from './inventories.controller';
import { InventoriesService } from './inventories.service';
import { DatabaseModule } from '../../database/database.module';
import { SharedModule } from '../../shared/shared.module';
import { CSV_CONFIG } from '../../config/inventory-csv.config';
import * as fs from 'fs';

// Ensure upload directory exists (for temporary uploads)
if (!fs.existsSync(CSV_CONFIG.UPLOAD_DIRECTORY)) {
  fs.mkdirSync(CSV_CONFIG.UPLOAD_DIRECTORY, { recursive: true });
}

@Module({
  imports: [
    DatabaseModule,
    SharedModule,
    MulterModule.register({
      dest: CSV_CONFIG.UPLOAD_DIRECTORY,
    }),
  ],
  controllers: [InventoriesController],
  providers: [InventoriesService],
  exports: [InventoriesService],
})
export class InventoriesModule {}

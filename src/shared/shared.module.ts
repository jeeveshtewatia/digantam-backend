import { Module } from '@nestjs/common';
import { S3Service } from './services/s3.service';
import { CommonUtilsService } from './services/common-utils.service';
import { CsvService } from './services/csv.service';

@Module({
  providers: [S3Service, CommonUtilsService, CsvService],
  exports: [S3Service, CommonUtilsService, CsvService],
})
export class SharedModule {}

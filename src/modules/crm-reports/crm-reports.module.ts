import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CrmReportsController } from './crm-reports.controller';
import { CrmReportsService } from './crm-reports.service';
import { CsvService } from '../../shared/services/csv.service';

@Module({
    imports: [DatabaseModule],
    controllers: [CrmReportsController],
    providers: [CrmReportsService, CsvService],
    exports: [CrmReportsService],
})
export class CrmReportsModule { }

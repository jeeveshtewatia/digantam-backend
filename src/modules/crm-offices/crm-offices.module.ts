import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CrmOfficesController } from './crm-offices.controller';
import { CrmOfficesService } from './crm-offices.service';

@Module({
    imports: [DatabaseModule],
    controllers: [CrmOfficesController],
    providers: [CrmOfficesService],
    exports: [CrmOfficesService],
})
export class CrmOfficesModule { }

import { Module } from '@nestjs/common';
import { CrmHolidaysService } from './crm-holidays.service';
import { CrmHolidaysController } from './crm-holidays.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [CrmHolidaysController],
    providers: [CrmHolidaysService],
    exports: [CrmHolidaysService],
})
export class CrmHolidaysModule { }

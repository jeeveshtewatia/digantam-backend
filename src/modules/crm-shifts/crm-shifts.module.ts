import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CrmShiftsController } from './crm-shifts.controller';
import { CrmShiftsService } from './crm-shifts.service';

@Module({
    imports: [DatabaseModule],
    controllers: [CrmShiftsController],
    providers: [CrmShiftsService],
    exports: [CrmShiftsService],
})
export class CrmShiftsModule { }

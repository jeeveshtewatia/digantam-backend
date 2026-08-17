import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CrmAttendanceController } from './crm-attendance.controller';
import { CrmAttendanceService } from './crm-attendance.service';
import { CrmOfficesModule } from '../crm-offices/crm-offices.module';

@Module({
    imports: [DatabaseModule, CrmOfficesModule],
    controllers: [CrmAttendanceController],
    providers: [CrmAttendanceService],
    exports: [CrmAttendanceService],
})
export class CrmAttendanceModule { }

import { Module } from '@nestjs/common';
import { CrmAttendanceRequestsService } from './crm-attendance-requests.service';
import { CrmAttendanceRequestsController } from './crm-attendance-requests.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [CrmAttendanceRequestsController],
    providers: [CrmAttendanceRequestsService],
    exports: [CrmAttendanceRequestsService],
})
export class CrmAttendanceRequestsModule { }

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CrmCronService } from './crm-cron.service';

@Module({
    imports: [DatabaseModule],
    providers: [CrmCronService],
})
export class CrmCronModule { }

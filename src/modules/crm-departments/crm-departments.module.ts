import { Module } from '@nestjs/common';
import { CrmDepartmentsService } from './crm-departments.service';
import { CrmDepartmentsController } from './crm-departments.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [CrmDepartmentsController],
    providers: [CrmDepartmentsService],
    exports: [CrmDepartmentsService],
})
export class CrmDepartmentsModule { }

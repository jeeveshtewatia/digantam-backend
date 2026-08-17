import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CrmLeavesController } from './crm-leaves.controller';
import { CrmLeavesService } from './crm-leaves.service';

@Module({
    imports: [DatabaseModule],
    controllers: [CrmLeavesController],
    providers: [CrmLeavesService],
    exports: [CrmLeavesService],
})
export class CrmLeavesModule { }

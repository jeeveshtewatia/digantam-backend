import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CrmUsersController } from './crm-users.controller';
import { CrmUsersService } from './crm-users.service';

@Module({
    imports: [DatabaseModule],
    controllers: [CrmUsersController],
    providers: [CrmUsersService],
    exports: [CrmUsersService],
})
export class CrmUsersModule { }

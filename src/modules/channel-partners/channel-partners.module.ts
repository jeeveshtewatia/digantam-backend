import { Module } from '@nestjs/common';
import { ChannelPartnersService } from './channel-partners.service';
import { ChannelPartnersController } from './channel-partners.controller';
import { DatabaseModule } from '../../database/database.module';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [DatabaseModule, SharedModule],
  controllers: [ChannelPartnersController],
  providers: [ChannelPartnersService],
  exports: [ChannelPartnersService],
})
export class ChannelPartnersModule {}

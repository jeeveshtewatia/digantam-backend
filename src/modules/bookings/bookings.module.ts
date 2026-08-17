import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { DatabaseModule } from '../../database/database.module';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [DatabaseModule, SharedModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}

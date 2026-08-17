import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ProjectsModule } from '../projects/projects.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [ProjectsModule, DatabaseModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

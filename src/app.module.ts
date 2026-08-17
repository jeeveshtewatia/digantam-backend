import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { InventoriesModule } from './modules/inventories/inventories.module';
import { CustomersModule } from './modules/customers/customers.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ChannelPartnersModule } from './modules/channel-partners/channel-partners.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
// CRM Attendance Modules
import { CrmAuthModule } from './modules/crm-auth/crm-auth.module';
import { CrmUsersModule } from './modules/crm-users/crm-users.module';
import { CrmOfficesModule } from './modules/crm-offices/crm-offices.module';
import { CrmShiftsModule } from './modules/crm-shifts/crm-shifts.module';
import { CrmAttendanceModule } from './modules/crm-attendance/crm-attendance.module';
import { CrmLeavesModule } from './modules/crm-leaves/crm-leaves.module';
import { CrmReportsModule } from './modules/crm-reports/crm-reports.module';
import { CrmCronModule } from './modules/crm-cron/crm-cron.module';
import { CrmHolidaysModule } from './modules/crm-holidays/crm-holidays.module';
import { CrmDepartmentsModule } from './modules/crm-departments/crm-departments.module';
import { CrmAttendanceRequestsModule } from './modules/crm-attendance-requests/crm-attendance-requests.module';
import { AssetsModule } from './modules/assets/assets.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    // Existing modules (unchanged)
    AuthModule,
    ProjectsModule,
    InventoriesModule,
    CustomersModule,
    BookingsModule,
    ChannelPartnersModule,
    AnalyticsModule,
    // CRM Attendance modules
    CrmAuthModule,
    CrmUsersModule,
    CrmOfficesModule,
    CrmShiftsModule,
    CrmAttendanceModule,
    CrmLeavesModule,
    CrmReportsModule,
    CrmCronModule,
    CrmHolidaysModule,
    CrmDepartmentsModule,
    CrmAttendanceRequestsModule,
    AssetsModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as moment from 'moment-timezone';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { AttendanceStatus, isWeeklyOff } from '../../config/constants';

const IST_TZ = 'Asia/Kolkata';

@Injectable()
export class CrmCronService {
    private readonly logger = new Logger(CrmCronService.name);

    constructor(private projectsUtilsService: ProjectsUtilsService) { }

    /**
     * Auto-Absent Job — runs every day at 11:00 PM IST
     * Skips: weekly-off days (Sunday + 2nd/4th Saturday) and company holidays
     */
    @Cron('0 23 * * *', { name: 'crm_auto_absent', timeZone: IST_TZ })
    async autoAbsentJob() {
        this.logger.log('⏰ Running CRM Auto-Absent Job...');

        try {
            const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
            const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
            const CrmHolidayModel = this.projectsUtilsService.getCrmHolidayModel();

            const nowIST = moment().tz(IST_TZ);
            const today = nowIST.format('YYYY-MM-DD');
            const todayDate = nowIST.toDate();

            // Guard: Only run in the evening (after 9 PM IST)
            const currentHour = nowIST.hour();
            if (currentHour < 21) {
                this.logger.log(`Skipping auto-absent: It is too early in the day (${nowIST.format('HH:mm')}). Job should only run in the evening.`);
                return;
            }

            // Skip weekly off days
            if (isWeeklyOff(todayDate)) {
                this.logger.log(`Skipping auto-absent: ${today} is a weekly off day`);
                return;
            }

            // Group employees by company, then check per-company holidays
            const employees = await CrmUserModel.find({ isActive: true }).lean();
            const companyIds = [...new Set(employees.map((e: any) => e.companyId || 'default'))];

            // Build holiday sets per company for today
            const holidayByCompany = new Map<string, boolean>();
            for (const cId of companyIds) {
                const holiday = await CrmHolidayModel.findOne({ companyId: cId, date: today, isActive: true }).lean();
                holidayByCompany.set(cId, !!holiday);
            }

            this.logger.log(`Processing ${employees.length} active employees`);
            let markedAbsent = 0;

            for (const employee of employees) {
                const companyId = (employee as any).companyId || 'default';

                // Skip if today is a holiday for this company
                if (holidayByCompany.get(companyId)) {
                    continue;
                }

                try {
                    const existing = await CrmAttendanceModel.findOne({
                        userId: employee._id,
                        date: today,
                    });

                    if (!existing) {
                        await CrmAttendanceModel.create({
                            companyId,
                            userId: employee._id,
                            date: today,
                            status: AttendanceStatus.ABSENT,
                            totalWorkMinutes: 0,
                            breakMinutes: 0,
                            lateMinutes: 0,
                            overtimeMinutes: 0,
                        });
                        markedAbsent++;
                    }
                } catch (err) {
                    this.logger.warn(`Auto-absent for user ${employee._id}: ${err.message}`);
                }
            }

            this.logger.log(`✅ Auto-Absent Job Complete. Marked ${markedAbsent} employees as ABSENT for ${today}`);
        } catch (error) {
            this.logger.error('❌ Auto-Absent Job failed', error.stack);
        }
    }

    /**
     * Auto-Checkout Job — runs every day at 00:05 AM IST
     * Closes attendance records for "yesterday" that have a check-in but no check-out
     */
    @Cron('5 0 * * *', { name: 'crm_auto_checkout', timeZone: IST_TZ })
    async autoCheckoutJob() {
        this.logger.log('⏰ Running CRM Auto-Checkout Job...');

        try {
            const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
            
            // "Yesterday" in IST
            const yesterday = moment().tz(IST_TZ).subtract(1, 'day').format('YYYY-MM-DD');

            const missedCheckouts = await CrmAttendanceModel.find({
                date: yesterday,
                'checkIn.time': { $exists: true },
                'checkOut.time': { $exists: false },
                status: { $ne: AttendanceStatus.ABSENT }
            });

            this.logger.log(`Found ${missedCheckouts.length} missed checkouts for ${yesterday}`);

            let updatedCount = 0;
            for (const attendance of missedCheckouts) {
                try {
                    // Set checkout to 7:00 PM of that day
                    const checkoutTime = moment.tz(`${yesterday} 19:00`, 'YYYY-MM-DD HH:mm', IST_TZ).toDate();
                    const checkInTime = new Date(attendance.checkIn.time);
                    
                    // Basic duration calculation (7 PM - checkInTime)
                    // We don't have access to break service logic here easily without duplication, 
                    // but we can assume net work time or just the gross duration.
                    // For consistency with CrmAttendanceService, we'll calculate gross duration.
                    const diffMs = checkoutTime.getTime() - checkInTime.getTime();
                    const totalWorkMinutes = Math.max(0, Math.floor(diffMs / 60000));

                    attendance.checkOut = {
                        time: checkoutTime
                    };
                    attendance.totalWorkMinutes = totalWorkMinutes;
                    attendance.remarks = 'System Auto-Checkout: Defaulting to 7 PM';
                    // Note: Status is kept as-is (PRESENT, LATE, etc.) per user request
                    
                    await attendance.save();
                    updatedCount++;
                } catch (err) {
                    this.logger.warn(`Failed to auto-checkout record ${attendance._id}: ${err.message}`);
                }
            }

            this.logger.log(`✅ Auto-Checkout Job Complete. Processed ${updatedCount} records for ${yesterday}`);
        } catch (error) {
            this.logger.error('❌ Auto-Checkout Job failed', error.stack);
        }
    }

    /**
     * Monthly Leave Accrual — runs on the 1st of every month at midnight IST
     * Credits 2 paid days to each active employee, capped at 6 (3-month carry-forward max)
     */
    @Cron('0 0 1 * *', { name: 'crm_leave_accrual', timeZone: IST_TZ })
    async leaveAccrualJob() {
        this.logger.log('📅 Running CRM Monthly Leave Accrual Job...');

        try {
            const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
            const MAX_BALANCE = 6;
            const ACCRUAL = 2;

            // For each active employee, credit up to the cap
            // We use bulkWrite for efficiency
            const employees = await CrmUserModel.find({ isActive: true }).select('_id leaveBalance').lean();
            
            const bulkOps = employees.map((emp: any) => {
                const current = emp.leaveBalance?.total ?? 0;
                if (current >= MAX_BALANCE) return null; // already capped, skip
                const credit = Math.min(ACCRUAL, MAX_BALANCE - current);
                return {
                    updateOne: {
                        filter: { _id: emp._id },
                        update: { $inc: { 'leaveBalance.total': credit } },
                    },
                };
            }).filter(Boolean);

            if (bulkOps.length > 0) {
                const result = await CrmUserModel.bulkWrite(bulkOps as any);
                this.logger.log(`✅ Leave Accrual: credited to ${result.modifiedCount} employees`);
            } else {
                this.logger.log('✅ Leave Accrual: all employees at max balance (6), nothing to credit');
            }
        } catch (error) {
            this.logger.error('❌ Leave Accrual Job failed', error.stack);
        }
    }

    /**
     * Yearly Quota Reset — runs on Jan 1st at midnight IST
     * Resets yearlyUsed to 0 and sets yearlyQuota back to 24 for all active employees
     */
    @Cron('0 0 1 1 *', { name: 'crm_yearly_quota_reset', timeZone: IST_TZ })
    async yearlyQuotaResetJob() {
        this.logger.log('🗓️ Running CRM Yearly Quota Reset Job...');
        try {
            const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
            const result = await CrmUserModel.updateMany(
                { isActive: true },
                {
                    $set: {
                        'leaveBalance.yearlyQuota': 24,
                        'leaveBalance.yearlyUsed': 0,
                    },
                },
            );
            this.logger.log(`✅ Yearly Quota Reset: reset ${result.modifiedCount} employees to yearlyQuota=24, yearlyUsed=0`);
        } catch (error) {
            this.logger.error('❌ Yearly Quota Reset Job failed', error.stack);
        }
    }
}

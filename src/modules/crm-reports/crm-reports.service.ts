import { Injectable } from '@nestjs/common';
import * as moment from 'moment-timezone';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { CsvService } from '../../shared/services/csv.service';

const IST_TZ = 'Asia/Kolkata';

@Injectable()
export class CrmReportsService {
    constructor(
        private projectsUtilsService: ProjectsUtilsService,
        private csvService: CsvService,
    ) { }

    async exportToCSV(companyId: string, startDate: string, endDate: string, department?: string) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();

        const matchStage: any = { companyId, date: { $gte: startDate, $lte: endDate } };

        if (department) {
            const users = await CrmUserModel.find({ companyId, department }).select('_id').lean();
            matchStage.userId = { $in: users.map((u: any) => u._id) };
        }

        const records = await CrmAttendanceModel.find(matchStage)
            .populate('userId', 'name email department')
            .sort({ date: 1, 'userId.name': 1 })
            .lean();

        const csvData = records.map((r: any) => ({
            Date: r.date,
            Employee: r.userId?.name || '—',
            Email: r.userId?.email || '—',
            Department: r.userId?.department || '—',
            Status: r.status,
            'Check In': r.checkIn?.time ? moment(r.checkIn.time).tz(IST_TZ).format('HH:mm') : '—',
            'Check Out': r.checkOut?.time ? moment(r.checkOut.time).tz(IST_TZ).format('HH:mm') : '—',
            'Work Time': r.totalWorkMinutes ? `${Math.floor(r.totalWorkMinutes / 60)}h ${r.totalWorkMinutes % 60}m` : '0h 0m',
            'Late (min)': r.lateMinutes || 0,
            'Overtime': r.overtimeMinutes ? `${Math.floor(r.overtimeMinutes / 60)}h ${r.overtimeMinutes % 60}m` : '0h 0m',
        }));

        const fields = ['Date', 'Employee', 'Email', 'Department', 'Status', 'Check In', 'Check Out', 'Work Time', 'Late (min)', 'Overtime'];
        return this.csvService.jsonToCsv(csvData, fields);
    }

    async getMonthlyReport(companyId: string, startDate: string, endDate: string, department?: string) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();

        const matchStage: any = { companyId, date: { $gte: startDate, $lte: endDate } };

        // If department filter — get userIds in that dept
        if (department) {
            const users = await CrmUserModel.find({ companyId, department }).select('_id').lean();
            matchStage.userId = { $in: users.map((u: any) => u._id) };
        }

        const pipeline: any[] = [
            { $match: matchStage },
            {
                $group: {
                    _id: '$userId',
                    totalDays: { $sum: 1 },
                    presentDays: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } },
                    lateDays: { $sum: { $cond: [{ $eq: ['$status', 'LATE'] }, 1, 0] } },
                    absentDays: { $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] } },
                    halfDays: { $sum: { $cond: [{ $eq: ['$status', 'HALF_DAY'] }, 1, 0] } },
                    wfhDays: { $sum: { $cond: [{ $eq: ['$status', 'WFH'] }, 1, 0] } },
                    totalWorkMinutes: { $sum: '$totalWorkMinutes' },
                    totalOvertimeMinutes: { $sum: '$overtimeMinutes' },
                    totalLateMinutes: { $sum: '$lateMinutes' },
                    totalBreakMinutes: { $sum: '$breakMinutes' },
                },
            },
            {
                $lookup: {
                    from: 'crm_users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    userId: '$_id',
                    name: '$user.name',
                    email: '$user.email',
                    department: '$user.department',
                    role: '$user.role',
                    totalDays: 1,
                    presentDays: 1,
                    lateDays: 1,
                    absentDays: 1,
                    halfDays: 1,
                    wfhDays: 1,
                    totalWorkMinutes: 1,
                    totalOvertimeMinutes: 1,
                    totalLateMinutes: 1,
                    totalBreakMinutes: 1,
                    avgWorkMinutesPerDay: {
                        $cond: [
                            { $gt: ['$totalDays', 0] },
                            { $divide: ['$totalWorkMinutes', '$totalDays'] },
                            0,
                        ],
                    },
                },
            },
            { $sort: { name: 1 } },
        ];

        const records = await CrmAttendanceModel.aggregate(pipeline);
        return {
            message: 'Monthly report generated',
            period: { startDate, endDate },
            department: department || 'all',
            data: records,
        };
    }

    async getEmployeeReport(userId: string, startDate: string, endDate: string) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();

        const [user, records] = await Promise.all([
            CrmUserModel.findById(userId).select('-passwordHash'),
            CrmAttendanceModel.find({
                userId,
                date: { $gte: startDate, $lte: endDate },
            }).sort({ date: 1 }).lean(),
        ]);

        const summary = records.reduce(
            (acc, r: any) => {
                acc.totalDays++;
                acc[r.status?.toLowerCase() + 'Days'] = (acc[r.status?.toLowerCase() + 'Days'] || 0) + 1;
                acc.totalWorkMinutes += r.totalWorkMinutes || 0;
                acc.totalOvertimeMinutes += r.overtimeMinutes || 0;
                return acc;
            },
            { totalDays: 0, totalWorkMinutes: 0, totalOvertimeMinutes: 0 },
        );

        return { user, period: { startDate, endDate }, summary, records };
    }

    async getDashboardStats(companyId: string) {
        const CrmAttendanceModel = this.projectsUtilsService.getCrmAttendanceModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const CrmLeaveModel = this.projectsUtilsService.getCrmLeaveModel();

        const today = moment().tz(IST_TZ).format('YYYY-MM-DD');

        // Build last 7 days array
        const last7Days: string[] = [];
        for (let i = 6; i >= 0; i--) {
            last7Days.push(moment().tz(IST_TZ).subtract(i, 'days').format('YYYY-MM-DD'));
        }

        const [totalEmployees, todayStats, onLeaveCount, weeklyTrend, deptStats] = await Promise.all([
            CrmUserModel.countDocuments({ companyId, isActive: true }),

            // Today's attendance by status
            CrmAttendanceModel.aggregate([
                { $match: { companyId, date: today } },
                { $group: { _id: '$status', count: { $sum: 1 }, totalOvertime: { $sum: '$overtimeMinutes' } } },
            ]),

            // On-leave today: approved leaves covering today
            CrmLeaveModel.countDocuments({
                companyId,
                status: 'APPROVED',
                startDate: { $lte: new Date(today) },
                endDate: { $gte: new Date(today) },
            }),

            // Weekly trend: last 7 days
            CrmAttendanceModel.aggregate([
                { $match: { companyId, date: { $in: last7Days } } },
                {
                    $group: {
                        _id: { date: '$date', status: '$status' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { '_id.date': 1 } },
            ]),

            // Department-wise attendance today
            CrmAttendanceModel.aggregate([
                { $match: { companyId, date: today } },
                {
                    $lookup: {
                        from: 'crm_users',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'user',
                    },
                },
                { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: { dept: '$user.department', status: '$status' },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

        const statsMap: any = {};
        let totalOvertimeMinutesToday = 0;
        for (const s of todayStats) {
            statsMap[s._id] = s.count;
            totalOvertimeMinutesToday += s.totalOvertime || 0;
        }

        // Build weekly trend per date
        const weeklyTrendMap: Record<string, any> = {};
        for (const d of last7Days) {
            weeklyTrendMap[d] = { date: d, present: 0, late: 0, absent: 0, halfDay: 0, wfh: 0 };
        }
        for (const w of weeklyTrend) {
            const d = w._id.date;
            const s = w._id.status?.toLowerCase();
            if (weeklyTrendMap[d] && s) {
                weeklyTrendMap[d][s === 'half_day' ? 'halfDay' : s] = w.count;
            }
        }

        // Department comparison
        const deptMap: Record<string, any> = {};
        for (const d of deptStats) {
            const dept = d._id.dept || 'Unassigned';
            if (!deptMap[dept]) deptMap[dept] = { department: dept, present: 0, late: 0, absent: 0 };
            const s = d._id.status?.toLowerCase();
            if (s === 'present' || s === 'late' || s === 'absent') deptMap[dept][s] = d.count;
        }

        return {
            message: 'Dashboard stats retrieved',
            date: today,
            totalEmployees,
            today: {
                present: statsMap['PRESENT'] || 0,
                late: statsMap['LATE'] || 0,
                absent: statsMap['ABSENT'] || 0,
                halfDay: statsMap['HALF_DAY'] || 0,
                wfh: statsMap['WFH'] || 0,
                onLeave: onLeaveCount,
                activeNow: (statsMap['PRESENT'] || 0) + (statsMap['LATE'] || 0),
                totalOvertimeMinutes: totalOvertimeMinutesToday,
            },
            weeklyTrend: Object.values(weeklyTrendMap),
            departmentComparison: Object.values(deptMap),
        };
    }
}

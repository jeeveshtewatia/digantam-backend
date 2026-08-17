import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { CreateCrmHolidayDto } from './dto/crm-holiday.dto';

@Injectable()
export class CrmHolidaysService {
    constructor(private projectsUtilsService: ProjectsUtilsService) { }

    async create(companyId: string, dto: CreateCrmHolidayDto) {
        const Model = this.projectsUtilsService.getCrmHolidayModel();

        const existing = await Model.findOne({ companyId, date: dto.date });
        if (existing) throw new ConflictException(`Holiday already exists on ${dto.date}`);

        const holiday = await Model.create({
            companyId,
            name: dto.name,
            date: dto.date,
            type: dto.type || 'company',
        });

        return { message: 'Holiday created', data: holiday };
    }

    async findAll(companyId: string, year?: string) {
        const Model = this.projectsUtilsService.getCrmHolidayModel();
        const query: any = { companyId, isActive: true };

        if (year) {
            query.date = { $gte: `${year}-01-01`, $lte: `${year}-12-31` };
        }

        const holidays = await Model.find(query).sort({ date: 1 }).lean();
        return { message: 'Holidays retrieved', data: holidays };
    }

    async delete(id: string) {
        const Model = this.projectsUtilsService.getCrmHolidayModel();
        const holiday = await Model.findByIdAndDelete(id);
        if (!holiday) throw new NotFoundException('Holiday not found');
        return { message: 'Holiday deleted' };
    }

    /** Utility: check if a date (YYYY-MM-DD) is a company holiday */
    async isHoliday(companyId: string, dateStr: string): Promise<boolean> {
        const Model = this.projectsUtilsService.getCrmHolidayModel();
        const doc = await Model.findOne({ companyId, date: dateStr, isActive: true }).lean();
        return !!doc;
    }

    /** Utility: get all holidays for a date range (for batch use in leave calculation) */
    async getHolidayDates(companyId: string, startDate: string, endDate: string): Promise<Set<string>> {
        const Model = this.projectsUtilsService.getCrmHolidayModel();
        const holidays = await Model.find({
            companyId,
            date: { $gte: startDate, $lte: endDate },
            isActive: true,
        }).lean();
        return new Set(holidays.map((h: any) => h.date));
    }
}

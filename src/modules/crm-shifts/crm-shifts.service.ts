import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { CreateCrmShiftDto } from './dto/crm-shift.dto';

@Injectable()
export class CrmShiftsService {
    constructor(private projectsUtilsService: ProjectsUtilsService) { }

    async create(dto: CreateCrmShiftDto, currentUser: any) {
        const CrmShiftModel = this.projectsUtilsService.getCrmShiftModel();
        const companyId = dto.companyId || currentUser?.companyId || 'default';

        const shift = await CrmShiftModel.create({
            companyId,
            name: dto.name,
            startTime: dto.startTime,
            endTime: dto.endTime,
            graceMinutes: dto.graceMinutes ?? 10,
            workingMinutes: dto.workingMinutes ?? 480,
        });

        return { message: 'Shift created successfully', data: shift };
    }

    async findAll(companyId: string) {
        const CrmShiftModel = this.projectsUtilsService.getCrmShiftModel();
        const shifts = await CrmShiftModel.find({ companyId }).sort({ name: 1 }).lean();
        return { message: 'Shifts retrieved', data: shifts };
    }

    async findById(id: string) {
        const CrmShiftModel = this.projectsUtilsService.getCrmShiftModel();
        const shift = await CrmShiftModel.findById(id);
        if (!shift) throw new NotFoundException('Shift not found');
        return shift;
    }

    async update(id: string, dto: Partial<CreateCrmShiftDto>) {
        const CrmShiftModel = this.projectsUtilsService.getCrmShiftModel();
        const shift = await CrmShiftModel.findByIdAndUpdate(id, dto, { new: true });
        if (!shift) throw new NotFoundException('Shift not found');
        return { message: 'Shift updated', data: shift };
    }

    async delete(id: string) {
        const CrmShiftModel = this.projectsUtilsService.getCrmShiftModel();
        const shift = await CrmShiftModel.findByIdAndDelete(id);
        if (!shift) throw new NotFoundException('Shift not found');
        return { message: 'Shift deleted' };
    }
}

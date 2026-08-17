import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { CreateCrmDepartmentDto, UpdateCrmDepartmentDto } from './dto/crm-department.dto';

@Injectable()
export class CrmDepartmentsService {
    constructor(private projectsUtilsService: ProjectsUtilsService) { }

    async create(companyId: string, dto: CreateCrmDepartmentDto) {
        const Model = this.projectsUtilsService.getCrmDepartmentModel();
        const existing = await Model.findOne({ companyId, name: dto.name });
        if (existing) throw new ConflictException(`Department '${dto.name}' already exists`);

        const dept = await Model.create({
            companyId,
            name: dto.name,
            description: dto.description,
            managerId: dto.managerId || null,
        });
        return { message: 'Department created', data: dept };
    }

    async findAll(companyId: string) {
        const Model = this.projectsUtilsService.getCrmDepartmentModel();
        const depts = await Model.find({ companyId, isActive: true })
            .populate('managerId', 'name email')
            .sort({ name: 1 })
            .lean();
        return { message: 'Departments retrieved', data: depts };
    }

    async findById(id: string) {
        const Model = this.projectsUtilsService.getCrmDepartmentModel();
        const dept = await Model.findById(id).populate('managerId', 'name email').lean();
        if (!dept) throw new NotFoundException('Department not found');
        return dept;
    }

    async update(id: string, companyId: string, dto: UpdateCrmDepartmentDto) {
        const Model = this.projectsUtilsService.getCrmDepartmentModel();
        const dept = await Model.findOneAndUpdate(
            { _id: id, companyId },
            { $set: dto },
            { new: true },
        ).populate('managerId', 'name email');
        if (!dept) throw new NotFoundException('Department not found');
        return { message: 'Department updated', data: dept };
    }

    async delete(id: string, companyId: string) {
        const Model = this.projectsUtilsService.getCrmDepartmentModel();
        const dept = await Model.findOneAndUpdate(
            { _id: id, companyId },
            { isActive: false },
            { new: true },
        );
        if (!dept) throw new NotFoundException('Department not found');
        return { message: 'Department deactivated' };
    }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { CreateCrmOfficeDto, ValidateLocationDto } from './dto/crm-office.dto';

@Injectable()
export class CrmOfficesService {
    constructor(private projectsUtilsService: ProjectsUtilsService) { }

    async create(dto: CreateCrmOfficeDto, currentUser: any) {
        const CrmOfficeModel = this.projectsUtilsService.getCrmOfficeModel();
        const companyId = dto.companyId || currentUser?.companyId || 'default';

        const office = await CrmOfficeModel.create({
            companyId,
            name: dto.name,
            location: {
                type: 'Point',
                coordinates: [dto.lng, dto.lat], // GeoJSON: [lng, lat]
            },
            allowedRadiusMeters: dto.allowedRadiusMeters,
        });

        return { message: 'Office created successfully', data: office };
    }

    async findAll(companyId: string) {
        const CrmOfficeModel = this.projectsUtilsService.getCrmOfficeModel();
        const offices = await CrmOfficeModel.find({ companyId }).lean();
        return { message: 'Offices retrieved', data: offices };
    }

    async findById(id: string) {
        const CrmOfficeModel = this.projectsUtilsService.getCrmOfficeModel();
        const office = await CrmOfficeModel.findById(id);
        if (!office) throw new NotFoundException('Office not found');
        return office;
    }

    async update(id: string, dto: Partial<CreateCrmOfficeDto>) {
        const CrmOfficeModel = this.projectsUtilsService.getCrmOfficeModel();
        const updateData: any = {};

        if (dto.name) updateData.name = dto.name;
        if (dto.allowedRadiusMeters) updateData.allowedRadiusMeters = dto.allowedRadiusMeters;
        if (dto.lat !== undefined && dto.lng !== undefined) {
            updateData.location = { type: 'Point', coordinates: [dto.lng, dto.lat] };
        }

        const office = await CrmOfficeModel.findByIdAndUpdate(id, updateData, { new: true });
        if (!office) throw new NotFoundException('Office not found');
        return { message: 'Office updated', data: office };
    }

    async delete(id: string) {
        const CrmOfficeModel = this.projectsUtilsService.getCrmOfficeModel();
        const office = await CrmOfficeModel.findByIdAndDelete(id);
        if (!office) throw new NotFoundException('Office not found');
        return { message: 'Office deleted successfully' };
    }

    async validateLocation(dto: ValidateLocationDto, companyId: string) {
        const CrmOfficeModel = this.projectsUtilsService.getCrmOfficeModel();
        const company = dto.companyId || companyId;

        // Use MongoDB $nearSphere to find offices within any configured radius
        // We query without maxDistance first, then filter by each office's own radius
        const offices = await CrmOfficeModel.find({ companyId: company, isActive: true }).lean();

        if (!offices || offices.length === 0) {
            return {
                valid: false,
                message: 'No active offices configured for this company',
                matchedOffice: null,
            };
        }

        // Calculate distance for each office and find the nearest one
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const R = 6371000; // Earth radius in meters

        let nearestOffice: any = null;
        let minDistance = Infinity;

        for (const office of offices) {
            const [offLng, offLat] = office.location.coordinates;
            const dLat = toRad(dto.lat - offLat);
            const dLng = toRad(dto.lng - offLng);
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(offLat)) * Math.cos(toRad(dto.lat)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;

            if (distance < minDistance) {
                minDistance = distance;
                nearestOffice = { ...office, distanceMeters: Math.round(distance) };
            }
        }

        if (nearestOffice) {
            const withinRadius = minDistance <= (nearestOffice.allowedRadiusMeters || 100);
            return {
                valid: withinRadius,
                message: withinRadius ? 'Location is within office geo-fence' : 'Location is outside office geo-fence',
                matchedOffice: nearestOffice,
            };
        }

        return {
            valid: false,
            message: 'No offices found',
            matchedOffice: null,
        };
    }
}

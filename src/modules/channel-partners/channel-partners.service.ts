import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateChannelPartnerDto } from './dto/create-channel-partner.dto';
import { UpdateChannelPartnerDto } from './dto/update-channel-partner.dto';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { CommonUtilsService } from '../../shared/services/common-utils.service';

@Injectable()
export class ChannelPartnersService {
  constructor(
    private projectsUtilsService: ProjectsUtilsService,
    private commonUtilsService: CommonUtilsService,
  ) {}

  async create(projectId: string, createChannelPartnerDto: CreateChannelPartnerDto) {
    const Model = await this.projectsUtilsService.getChannelPartnersModel();
    
    const cpId = createChannelPartnerDto.id || this.commonUtilsService.generateId(8);
    const existing = await Model.findOne({ id: cpId });
    if (existing) {
      throw new ConflictException(`Channel Partner with ID ${cpId} already exists`);
    }

    const created = await Model.create({
      ...createChannelPartnerDto,
      id: cpId,
      project_id: projectId,
    });
    return created;
  }

  async findAll(projectId: string) {
    const Model = await this.projectsUtilsService.getChannelPartnersModel();
    return Model.find({ project_id: projectId }).sort({ createdAt: -1 });
  }

  async findOne(projectId: string, cpId: string) {
    const Model = await this.projectsUtilsService.getChannelPartnersModel();
    const cp = await Model.findOne({ project_id: projectId, id: cpId });
    if (!cp) {
      throw new NotFoundException(`Channel Partner with ID ${cpId} not found in project ${projectId}`);
    }
    return cp;
  }

  async update(projectId: string, cpId: string, updateChannelPartnerDto: UpdateChannelPartnerDto) {
    const Model = await this.projectsUtilsService.getChannelPartnersModel();
    const updated = await Model.findOneAndUpdate(
      { project_id: projectId, id: cpId },
      updateChannelPartnerDto,
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException(`Channel Partner with ID ${cpId} not found in project ${projectId}`);
    }
    return updated;
  }

  async remove(projectId: string, cpId: string) {
    const Model = await this.projectsUtilsService.getChannelPartnersModel();
    const deleted = await Model.findOneAndDelete({ project_id: projectId, id: cpId });

    if (!deleted) {
      throw new NotFoundException(`Channel Partner with ID ${cpId} not found in project ${projectId}`);
    }
    return { message: 'Channel Partner deleted successfully' };
  }
}

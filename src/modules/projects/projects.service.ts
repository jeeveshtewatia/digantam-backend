import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { DEFAULT_INVENTORY_SCHEMA, DEFAULT_CUSTOMER_SCHEMA } from '../../config/constants';

@Injectable()
export class ProjectsService {
  constructor(private projectsUtilsService: ProjectsUtilsService) {}

  /**
   * Merge default inventory schema with custom schema
   * Default fields are always included, custom fields add/override
   */
  private mergeInventorySchema(customSchema?: any) {
    return {
      ...DEFAULT_INVENTORY_SCHEMA, // Always include defaults
      ...(customSchema || {}), // Merge custom fields (can override defaults)
    };
  }

  /**
   * Merge default customer schema with custom schema
   * Default fields are always included, custom fields add/override
   */
  private mergeCustomerSchema(customSchema?: any) {
    return {
      ...DEFAULT_CUSTOMER_SCHEMA, // Always include defaults
      ...(customSchema || {}), // Merge custom fields (can override defaults)
    };
  }

  async create(createProjectDto: CreateProjectDto) {
    const ProjectModel = this.projectsUtilsService.getProjectModel();

    // Check if projectId already exists
    const existingProject = await ProjectModel.findOne({ projectId: createProjectDto.projectId });
    if (existingProject) {
      throw new ConflictException('Project ID already exists');
    }

    // Merge default schemas with custom schemas before saving
    // This ensures default fields are always present and visible to frontend
    const projectData = {
      ...createProjectDto,
      inventorySchema: this.mergeInventorySchema(createProjectDto.inventorySchema),
      customerSchema: this.mergeCustomerSchema(createProjectDto.customerSchema),
    };

    // Create project with merged schemas
    const project = await ProjectModel.create(projectData);

    return {
      message: 'Project created successfully',
      project,
    };
  }

  async findAll(includeInactive = false) {
    const ProjectModel = this.projectsUtilsService.getProjectModel();

    const filter = includeInactive ? {} : { is_active: true };
    const projects = await ProjectModel.find(filter).sort({ createdAt: -1 });

    return {
      count: projects.length,
      projects,
    };
  }

  async findOne(projectId: string) {
    const ProjectModel = this.projectsUtilsService.getProjectModel();
    const project = await ProjectModel.findOne({ projectId });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(projectId: string, updateProjectDto: UpdateProjectDto) {
    const ProjectModel = this.projectsUtilsService.getProjectModel();

    // If schemas are being updated, merge with defaults
    const updateData: any = { ...updateProjectDto };

    if (updateProjectDto.inventorySchema !== undefined) {
      // Get current project to merge with existing schema
      const currentProject = await ProjectModel.findOne({ projectId });
      if (currentProject) {
        // Merge: defaults + existing + new custom
        // This preserves existing custom fields while adding new ones
        updateData.inventorySchema = this.mergeInventorySchema({
          ...currentProject.inventorySchema,
          ...updateProjectDto.inventorySchema,
        });
      } else {
        // New project, just merge defaults + custom
        updateData.inventorySchema = this.mergeInventorySchema(updateProjectDto.inventorySchema);
      }
    }

    if (updateProjectDto.customerSchema !== undefined) {
      const currentProject = await ProjectModel.findOne({ projectId });
      if (currentProject) {
        updateData.customerSchema = this.mergeCustomerSchema({
          ...currentProject.customerSchema,
          ...updateProjectDto.customerSchema,
        });
      } else {
        updateData.customerSchema = this.mergeCustomerSchema(updateProjectDto.customerSchema);
      }
    }

    const project = await ProjectModel.findOneAndUpdate({ projectId }, updateData, {
      new: true,
      runValidators: true,
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return {
      message: 'Project updated successfully',
      project,
    };
  }

  async delete(projectId: string) {
    const ProjectModel = this.projectsUtilsService.getProjectModel();

    const project = await ProjectModel.findOneAndDelete({ projectId });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return {
      message: 'Project deleted successfully',
    };
  }

  async toggleStatus(projectId: string) {
    const ProjectModel = this.projectsUtilsService.getProjectModel();
    const project = await ProjectModel.findOne({ projectId });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    project.is_active = !project.is_active;
    await project.save();

    return {
      message: `Project ${project.is_active ? 'activated' : 'deactivated'} successfully`,
      project,
    };
  }

  async getProjectStatus(projectId: string) {
    const ProjectModel = this.projectsUtilsService.getProjectModel();
    const project = await ProjectModel.findOne({ projectId });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return {
      is_active: project.is_active,
      projectName: project.projectName,
      projectId: project.projectId,
    };
  }
}

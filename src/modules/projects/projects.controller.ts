import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { UserRole } from '../../config/constants';

@ApiTags('Projects Management')
@ApiBearerAuth('JWT-auth')
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new project (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  @ApiResponse({ status: 409, description: 'Project ID already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  async create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all projects' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Projects retrieved successfully' })
  async findAll(@Query('includeInactive') includeInactive?: boolean) {
    return this.projectsService.findAll(includeInactive);
  }

  @Get(':projectId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiResponse({ status: 200, description: 'Project retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findOne(@Param('projectId') projectId: string) {
    return this.projectsService.findOne(projectId);
  }

  @Put(':projectId')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update project (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async update(@Param('projectId') projectId: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(projectId, updateProjectDto);
  }

  @Delete(':projectId')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete project (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Project deleted successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async delete(@Param('projectId') projectId: string) {
    return this.projectsService.delete(projectId);
  }

  @Put(':projectId/toggle-status')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Toggle project active status (Super Admin only)',
    description: 'Only Super Admin can activate or deactivate projects. When deactivated, the project will be restricted from all users except Super Admin.'
  })
  @ApiResponse({ status: 200, description: 'Project status toggled successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  async toggleStatus(@Param('projectId') projectId: string) {
    return this.projectsService.toggleStatus(projectId);
  }

  @Get(':projectId/status')
  @Public()
  @ApiOperation({ 
    summary: 'Get project status',
    description: 'Check if project is active. Public endpoint for frontend to check project availability.'
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiResponse({ status: 200, description: 'Project status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProjectStatus(@Param('projectId') projectId: string) {
    return this.projectsService.getProjectStatus(projectId);
  }
}

import { Injectable, CanActivate, ExecutionContext, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { UserRole } from '../../config/constants';

@Injectable()
export class ProjectValidationGuard implements CanActivate {
  constructor(private projectsUtilsService: ProjectsUtilsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const projectId = request.params.projectId || request.body.project_id || request.query.project_id;
    const user = request.user;

    if (!projectId) {
      throw new NotFoundException('Project ID not provided');
    }

    const ProjectModel = this.projectsUtilsService.getProjectModel();
    const project = await ProjectModel.findOne({ projectId });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Super admin can access inactive projects (for management)
    if (user?.role === UserRole.SUPER_ADMIN) {
      request.projectId = projectId;
      if (request.body) {
        request.body.project_id = projectId;
      }
      return true;
    }

    // Check if project is active
    if (!project.is_active) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Project is inactive',
        projectName: project.projectName,
      });
    }

    request.projectId = projectId;
    if (request.body) {
      request.body.project_id = projectId;
    }

    return true;
  }
}

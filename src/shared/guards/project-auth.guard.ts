import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { UserRole } from '../../config/constants';

@Injectable()
export class ProjectAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private projectsUtilsService: ProjectsUtilsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const projectId = request.projectId;

    // If no user or projectId, let other guards handle authentication
    if (!user || !projectId) {
      return true;
    }

    // Super admin can access all projects
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Check if project requires authentication
    const ProjectModel = this.projectsUtilsService.getProjectModel();
    const project = await ProjectModel.findOne({ projectId });

    if (!project) {
      throw new ForbiddenException('Project not found');
    }

    // If project doesn't require auth, allow access
    if (!project.requires_auth) {
      return true;
    }

    // STRICT ENFORCEMENT: User MUST have project_id to access project-specific endpoints
    if (!user.project_id) {
      throw new ForbiddenException(
        'You do not have access to this project. Project-specific access required.',
      );
    }

    // STRICT CHECK: User's project_id MUST match the requested projectId
    if (user.project_id !== projectId) {
      throw new ForbiddenException(
        `You do not have access to this project. Your access is limited to project: ${user.project_id}`,
      );
    }

    return true;
  }
}

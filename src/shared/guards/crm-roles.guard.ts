import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CrmRole } from '../../config/constants';
import { CRM_ROLES_KEY } from '../decorators/crm-roles.decorator';

@Injectable()
export class CrmRolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<CrmRole[]>(CRM_ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.crmUser;

        if (!user) {
            throw new ForbiddenException('CRM authentication required');
        }

        if (!requiredRoles.includes(user.role)) {
            throw new ForbiddenException(
                `Access denied. Required role(s): ${requiredRoles.join(', ')}. Your role: ${user.role}`,
            );
        }

        return true;
    }
}

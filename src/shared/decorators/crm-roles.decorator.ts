import { SetMetadata } from '@nestjs/common';
import { CrmRole } from '../../config/constants';

export const CRM_ROLES_KEY = 'crm_roles';
export const CrmRoles = (...roles: CrmRole[]) => SetMetadata(CRM_ROLES_KEY, roles);

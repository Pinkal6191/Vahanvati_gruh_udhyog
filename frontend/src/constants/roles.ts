import { Role } from '../types/auth.types';

export const ROLES: Record<Role, Role> = {
  ADMIN: 'ADMIN',
  OUTLET: 'OUTLET',
  PRODUCTION: 'PRODUCTION',
};

export const ALL_ROLES: Role[] = ['ADMIN', 'OUTLET', 'PRODUCTION'];

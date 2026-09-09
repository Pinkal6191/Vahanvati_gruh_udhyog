import { Role, User } from '../types/auth.types';
import { NavGroup } from '../types/navigation.types';
import { NAVIGATION_GROUPS } from '../constants/navigation';

/**
 * Checks if a user has one of the allowed roles
 */
export function hasRole(user: User | null | undefined, allowedRoles?: Role | Role[]): boolean {
  if (!user || user.isActive === false) return false;
  if (!allowedRoles) return true;
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (roles.length === 0) return true;
  return roles.includes(user.role);
}

/**
 * Checks whether a user can access a specific route
 */
export function canAccessRoute(
  first: string | User | null | undefined,
  second: User | string | null | undefined
): boolean {
  const path = typeof first === 'string' ? first : typeof second === 'string' ? second : '';
  const user = (typeof first === 'object' ? first : second) as User | null | undefined;

  if (!user || user.isActive === false) return false;
  if (path === '/' || path === '/dashboard') return true;

  // Check navigation groups
  for (const group of NAVIGATION_GROUPS) {
    for (const item of group.items) {
      if (item.path === path || path.startsWith(item.path + '/')) {
        return item.roles.includes(user.role);
      }
    }
  }

  // Fallback: Admin can access all application routes
  return user.role === 'ADMIN';
}

/**
 * Filter navigation groups based on current user's role
 */
export function filterNavigationByRole(groups: NavGroup[], user: User | null | undefined): NavGroup[] {
  if (!user) return [];

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(user.role)),
    }))
    .filter((group) => group.items.length > 0);
}

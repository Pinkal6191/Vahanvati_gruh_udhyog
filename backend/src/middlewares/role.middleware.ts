import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../common/errors/app-error.js';

type UserRole = 'ADMIN' | 'OUTLET' | 'PRODUCTION';

export function authorize(allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new ForbiddenError(
          `Access forbidden: Role '${req.user.role}' is not authorized to perform this action`
        )
      );
      return;
    }

    next();
  };
}

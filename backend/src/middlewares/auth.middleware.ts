import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../common/errors/app-error.js';
import { prisma } from '../config/database.js';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: 'ADMIN' | 'OUTLET' | 'PRODUCTION';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
      sub: string;
      username: string;
      role: 'ADMIN' | 'OUTLET' | 'PRODUCTION';
    };

    // Verify user is still active in database
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      next(new UnauthorizedError('User account is inactive or no longer exists'));
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    next();
  } catch (_err) {
    next(new UnauthorizedError('Invalid or expired authentication token'));
  }
}

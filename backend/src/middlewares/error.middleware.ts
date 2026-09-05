import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/app-error.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Handle Prisma Known Request Errors safely without leaking internals
  if (err.name === 'PrismaClientKnownRequestError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'DATABASE_CONSTRAINT_ERROR',
        message: 'A database constraint violation occurred.',
      },
    });
    return;
  }

  console.error('💥 Unhandled Error:', err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production' ? 'An unexpected internal error occurred' : err.message,
    },
  });
}

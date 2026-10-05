import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  logger.error(`[Unhandled Error] ${req.method} ${req.originalUrl}:`, err);

  // Handle ApiError
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // Handle ZodError
  if (err instanceof ZodError) {
    res.status(400).json({
      error: err.errors.map((e) => e.message).join(', ') || 'Invalid request data',
      details: err.errors,
    });
    return;
  }

  // Handle Prisma Known Errors (like unique constraint violation)
  if (err.code === 'P2002') {
    res.status(400).json({
      error: `A unique constraint failed on field(s): ${err.meta?.target || 'unknown'}`,
    });
    return;
  }

  // Default internal server error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
  });
};

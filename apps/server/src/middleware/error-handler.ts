import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class ApiError extends Error implements AppError {
  statusCode: number;
  code: string;
  details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';

  // Log error with stack trace
  logger.error(`Error ${code}: ${message}`, {
    statusCode,
    code,
    path: req.path,
    method: req.method,
    stack: err.stack,
    details: err.details,
  });

  // Send error response
  res.status(statusCode).json({
    error: {
      code,
      message,
      statusCode,
      ...(err.details && { details: err.details }),
    },
  });
};

// Helper functions to create common errors
export const createAuthError = (message: string = 'Authentication required') => {
  return new ApiError(401, 'AUTH_REQUIRED', message);
};

export const createForbiddenError = (message: string = 'Access forbidden') => {
  return new ApiError(403, 'FORBIDDEN', message);
};

export const createNotFoundError = (message: string = 'Resource not found') => {
  return new ApiError(404, 'NOT_FOUND', message);
};

export const createValidationError = (message: string, details?: any) => {
  return new ApiError(400, 'INVALID_INPUT', message, details);
};

export const createRateLimitError = () => {
  return new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later');
};

export const createInternalError = (message: string = 'Internal server error') => {
  return new ApiError(500, 'INTERNAL_ERROR', message);
};

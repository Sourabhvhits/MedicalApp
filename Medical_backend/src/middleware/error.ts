import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { ApiError, type ApiErrorDetail } from '../utils/ApiError';
import { logger } from '../lib/logger';
import { env } from '../config/env';

interface ErrorBody {
  success: false;
  message: string;
  code: string;
  details?: ApiErrorDetail[];
  stack?: string;
}

function translatePrismaError(error: Prisma.PrismaClientKnownRequestError): ApiError {
  const target = (error.meta?.target as string[] | string | undefined) ?? [];
  const fields = Array.isArray(target) ? target.join(', ') : String(target);

  switch (error.code) {
    case 'P2002':
      return ApiError.conflict(`A record with this ${fields || 'value'} already exists`);
    case 'P2003':
      return ApiError.badRequest('Related record not found — check the referenced ids');
    case 'P2025':
      return ApiError.notFound('Record not found');
    case 'P2014':
      return ApiError.badRequest('This change would break a required relation');
    default:
      return ApiError.internal('Database request failed');
  }
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let apiError: ApiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof ZodError) {
    apiError = ApiError.unprocessable(
      'Validation failed',
      error.issues.map((i) => ({ field: i.path.join('.'), message: i.message, code: i.code })),
    );
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    apiError = translatePrismaError(error);
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    apiError = ApiError.badRequest('Invalid data supplied to the database layer');
  } else if (error instanceof MulterError) {
    apiError =
      error.code === 'LIMIT_FILE_SIZE'
        ? ApiError.badRequest(`File is larger than ${env.MAX_UPLOAD_SIZE_MB} MB`)
        : ApiError.badRequest(error.message);
  } else {
    apiError = ApiError.internal();
  }

  const logPayload = {
    method: req.method,
    url: req.originalUrl,
    statusCode: apiError.statusCode,
    userId: req.user?.id,
    err: error,
  };

  if (apiError.statusCode >= 500) logger.error(logPayload, apiError.message);
  else logger.warn(logPayload, apiError.message);

  const body: ErrorBody = {
    success: false,
    message: apiError.message,
    code: apiError.code,
  };
  if (apiError.details) body.details = apiError.details;
  if (!env.isProd && error instanceof Error) body.stack = error.stack;

  res.status(apiError.statusCode).json(body);
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

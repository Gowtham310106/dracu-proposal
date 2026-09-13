import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { logger } from '../config/logger.js';
import { isProd } from '../config/env.js';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (message = 'Not found') => new AppError(404, 'NOT_FOUND', message);
export const badRequest = (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Unauthorized') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Forbidden') => new AppError(403, 'FORBIDDEN', message);
export const conflict = (message: string, details?: unknown) => new AppError(409, 'CONFLICT', message, details);

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ success: false, error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    res.status(400).json({ success: false, error: { code: 'VALIDATION', message: details[0]?.message ?? 'Invalid input', details } });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ success: false, error: { code: 'BAD_ID', message: `Invalid ${err.path}` } });
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    res.status(400).json({ success: false, error: { code: 'VALIDATION', message: details[0]?.message ?? 'Invalid input', details } });
    return;
  }
  const mongoErr = err as { code?: number; keyValue?: Record<string, unknown> };
  if (mongoErr?.code === 11000) {
    const field = Object.keys(mongoErr.keyValue ?? {})[0] ?? 'field';
    res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: `${field} already exists`, details: mongoErr.keyValue } });
    return;
  }
  logger.error({ err, url: req.originalUrl }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL', message: isProd ? 'Something went wrong' : (err as Error)?.message ?? 'Internal error' },
  });
};

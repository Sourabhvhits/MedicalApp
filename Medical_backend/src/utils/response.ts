import type { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function ok<T>(res: Response, data: T, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

export function created<T>(res: Response, data: T, message = 'Created successfully') {
  return ok(res, data, message, 201);
}

export function noContent(res: Response, message = 'Deleted successfully') {
  return res.status(200).json({ success: true, message, data: null });
}

export function paginated<T>(
  res: Response,
  items: T[],
  meta: PaginationMeta,
  message = 'Success',
  extra?: Record<string, unknown>,
) {
  return res.status(200).json({ success: true, message, data: items, meta, ...extra });
}

export function buildMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../config/constants';

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export function getPagination(query: { page?: unknown; limit?: unknown }): PageParams {
  const page = Math.max(1, Number(query.page) || 1);
  const rawLimit = Number(query.limit) || DEFAULT_PAGE_SIZE;
  const limit = Math.min(Math.max(1, rawLimit), MAX_PAGE_SIZE);
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export type SortOrder = 'asc' | 'desc';

export function getSort<T extends string>(
  sortBy: unknown,
  sortOrder: unknown,
  allowed: readonly T[],
  fallback: T,
): { field: T; order: SortOrder } {
  const field = allowed.includes(sortBy as T) ? (sortBy as T) : fallback;
  const order: SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
  return { field, order };
}

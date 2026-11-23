import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../config/constants';

export const idParam = z.object({ id: z.string().uuid('Invalid id') });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(191).optional(),
  sortBy: z.string().trim().max(40).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const recordStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']);
export const approvalStatusEnum = z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED']);

export const dateRangeQuery = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const exportQuery = z.object({
  format: z.enum(['json', 'csv', 'excel', 'pdf']).default('json'),
});

export type PaginationQuery = z.infer<typeof paginationQuery>;

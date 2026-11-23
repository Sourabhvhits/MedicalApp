import { z } from 'zod';
import { paginationQuery } from '../../common/query.validation';

export const raiseDisputeSchema = z.object({
  reason: z.string().trim().min(10, 'Explain the issue in a bit more detail').max(1000),
});

export const resolveDisputeSchema = z.object({
  status: z.enum(['RESOLVED', 'REJECTED']),
  resolution: z.string().trim().min(3).max(1000),
});

export const disputeListQuery = paginationQuery.extend({
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED']).optional(),
});

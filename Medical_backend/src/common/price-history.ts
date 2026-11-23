import type { OwnerType, Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';
import { D } from '../utils/money';

const TRACKED_FIELDS = ['sellingPrice', 'purchasePrice', 'mrp', 'discountPct'] as const;
type TrackedField = (typeof TRACKED_FIELDS)[number];

type PriceRecord = Partial<Record<TrackedField, Prisma.Decimal | number | string | null>>;

/**
 * Records every price change so the platform keeps the audit history required
 * by business rule 19. Called after a catalog row is updated.
 */
export async function recordPriceChanges(args: {
  productId: string;
  ownerType: OwnerType;
  ownerId: string;
  before: PriceRecord;
  after: PriceRecord;
  changedById?: string;
}): Promise<void> {
  const entries = TRACKED_FIELDS.flatMap((field) => {
    const previous = args.before[field];
    const next = args.after[field];
    if (next === undefined || next === null) return [];
    if (previous !== undefined && previous !== null && D(previous).equals(D(next))) return [];

    return [
      {
        productId: args.productId,
        ownerType: args.ownerType,
        ownerId: args.ownerId,
        field,
        oldValue: previous === undefined || previous === null ? null : D(previous),
        newValue: D(next),
        changedById: args.changedById ?? null,
      },
    ];
  });

  if (entries.length > 0) await prisma.priceHistory.createMany({ data: entries });
}

export async function listPriceHistory(ownerType: OwnerType, ownerId: string, productId: string) {
  return prisma.priceHistory.findMany({
    where: { ownerType, ownerId, productId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

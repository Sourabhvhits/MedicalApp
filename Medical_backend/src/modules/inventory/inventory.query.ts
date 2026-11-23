import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { buildMeta } from '../../utils/response';
import { getPagination } from '../../utils/pagination';
import { toNumber } from '../../utils/money';
import { dayjs, endOfDay, startOfDay } from '../../utils/time';
import { EXPIRY_BUCKETS } from '../../config/constants';
import type { StockOwner } from './inventory.service';

const ownerFilter = (owner: StockOwner) =>
  owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId };

// ---------------------------------------------------------------------------
// Stock listing
// ---------------------------------------------------------------------------

export async function listStock(owner: StockOwner, query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.InventoryBatchWhereInput = {
    ...ownerFilter(owner),
    ...(query.warehouseId ? { warehouseId: query.warehouseId as string } : {}),
    ...(query.productId ? { productId: query.productId as string } : {}),
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.includeDepleted ? {} : { quantity: { gt: 0 } }),
  };

  if (query.search || query.categoryId) {
    where.product = {
      ...(query.categoryId ? { categoryId: query.categoryId as string } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search as string } },
              { genericName: { contains: query.search as string } },
              { brandName: { contains: query.search as string } },
              { sku: { contains: query.search as string } },
            ],
          }
        : {}),
    };
  }

  if (query.batchNumber) where.batchNumber = { contains: query.batchNumber as string };

  if (query.expiringInDays !== undefined) {
    where.expiryDate = {
      gt: new Date(),
      lte: dayjs().add(Number(query.expiringInDays), 'day').toDate(),
    };
  }

  const [items, total] = await Promise.all([
    prisma.inventoryBatch.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            genericName: true,
            brandName: true,
            packSize: true,
            category: { select: { id: true, name: true } },
            unit: { select: { code: true } },
          },
        },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { expiryDate: 'asc' },
      skip,
      take,
    }),
    prisma.inventoryBatch.count({ where }),
  ]);

  return {
    items: items.map((batch) => ({
      ...batch,
      availableQty: batch.quantity + batch.freeQuantity - batch.reservedQty,
      daysToExpiry: dayjs(batch.expiryDate).startOf('day').diff(dayjs().startOf('day'), 'day'),
      stockValue: toNumber(batch.purchasePrice) * (batch.quantity + batch.freeQuantity),
    })),
    meta: buildMeta(page, limit, total),
  };
}

/** Product-level stock position (aggregated across batches). */
export async function listStockSummary(owner: StockOwner, query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);

  const warehouses = await prisma.warehouse.findMany({
    where: ownerFilter(owner),
    select: { id: true },
  });
  const warehouseIds = warehouses.map((w) => w.id);
  if (warehouseIds.length === 0) return { items: [], meta: buildMeta(page, limit, 0) };

  const where: Prisma.InventoryWhereInput = { warehouseId: { in: warehouseIds } };

  // Column-to-column comparison so the low-stock filter is applied in SQL and
  // the pagination total stays correct.
  if (query.lowStockOnly) {
    where.availableQty = { lte: prisma.inventory.fields.minStockAlert };
  }

  if (query.search || query.categoryId) {
    where.product = {
      ...(query.categoryId ? { categoryId: query.categoryId as string } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search as string } },
              { genericName: { contains: query.search as string } },
              { sku: { contains: query.search as string } },
            ],
          }
        : {}),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            brandName: true,
            packSize: true,
            mrp: true,
            category: { select: { id: true, name: true } },
          },
        },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { availableQty: 'asc' },
      skip,
      take,
    }),
    prisma.inventory.count({ where }),
  ]);

  const items = rows.map((row) => ({
    ...row,
    isLowStock: row.availableQty <= row.minStockAlert,
    isOutOfStock: row.availableQty === 0,
  }));

  return { items, meta: buildMeta(page, limit, total) };
}

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

export async function expirySummary(owner: StockOwner) {
  const now = new Date();

  const [expired, ...buckets] = await Promise.all([
    prisma.inventoryBatch.aggregate({
      where: { ...ownerFilter(owner), quantity: { gt: 0 }, expiryDate: { lte: now } },
      _count: true,
      _sum: { quantity: true },
    }),
    ...EXPIRY_BUCKETS.map((days) =>
      prisma.inventoryBatch.aggregate({
        where: {
          ...ownerFilter(owner),
          quantity: { gt: 0 },
          status: 'ACTIVE',
          expiryDate: { gt: now, lte: dayjs().add(days, 'day').toDate() },
        },
        _count: true,
        _sum: { quantity: true },
      }),
    ),
  ]);

  const valueAtRisk = await prisma.$queryRaw<{ value: string }[]>`
    SELECT COALESCE(SUM(purchasePrice * (quantity + freeQuantity)), 0) AS value
    FROM inventory_batches
    WHERE quantity > 0
      AND expiryDate <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
      AND ${owner.ownerType === 'VENDOR' ? Prisma.sql`vendorId = ${owner.vendorId}` : Prisma.sql`retailerId = ${owner.retailerId}`}`;

  return {
    expired: { batches: expired._count, quantity: expired._sum.quantity ?? 0 },
    buckets: EXPIRY_BUCKETS.map((days, index) => ({
      days,
      batches: buckets[index]._count,
      quantity: buckets[index]._sum.quantity ?? 0,
    })),
    stockValueAtRisk: Number(valueAtRisk[0]?.value ?? 0),
  };
}

/**
 * Tiered clearance-discount suggestion (TASKS.md #30) — tighter to expiry,
 * steeper the suggested cut. Purely advisory: nothing here writes to the
 * catalogue, it only annotates rows so the frontend can offer a one-click
 * "apply" that reuses the existing catalogue price-update endpoint.
 */
const CLEARANCE_TIERS = [
  { maxDays: 7, pct: 50 },
  { maxDays: 15, pct: 30 },
  { maxDays: 30, pct: 15 },
] as const;

function suggestClearancePct(daysToExpiry: number): number | null {
  if (daysToExpiry < 0) return null;
  return CLEARANCE_TIERS.find((tier) => daysToExpiry <= tier.maxDays)?.pct ?? null;
}

export async function listExpiring(owner: StockOwner, days: number, query: Record<string, unknown>) {
  const result = await listStock(owner, { ...query, expiringInDays: days, status: 'ACTIVE' });
  if (result.items.length === 0) return result;

  const productIds = Array.from(new Set(result.items.map((item) => item.productId)));
  const catalogEntries =
    owner.ownerType === 'VENDOR'
      ? await prisma.vendorProduct.findMany({
          where: { vendorId: owner.vendorId!, productId: { in: productIds } },
          select: { id: true, productId: true, discountPct: true, sellingPrice: true, mrp: true },
        })
      : await prisma.retailerProduct.findMany({
          where: { retailerId: owner.retailerId!, productId: { in: productIds } },
          select: { id: true, productId: true, discountPct: true, sellingPrice: true, mrp: true },
        });
  const catalogByProduct = new Map(catalogEntries.map((entry) => [entry.productId, entry]));

  return {
    ...result,
    items: result.items.map((item) => {
      const catalogEntry = catalogByProduct.get(item.productId);
      return {
        ...item,
        suggestedClearancePct: suggestClearancePct(item.daysToExpiry),
        catalogEntryId: catalogEntry?.id ?? null,
        catalogDiscountPct: catalogEntry ? toNumber(catalogEntry.discountPct) : null,
        catalogMrp: catalogEntry ? toNumber(catalogEntry.mrp) : null,
      };
    }),
  };
}

export async function listExpired(owner: StockOwner, query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.InventoryBatchWhereInput = {
    ...ownerFilter(owner),
    quantity: { gt: 0 },
    expiryDate: { lte: new Date() },
  };

  const [items, total] = await Promise.all([
    prisma.inventoryBatch.findMany({
      where,
      include: { product: { select: { id: true, name: true, sku: true, packSize: true } } },
      orderBy: { expiryDate: 'asc' },
      skip,
      take,
    }),
    prisma.inventoryBatch.count({ where }),
  ]);

  return {
    items: items.map((batch) => ({
      ...batch,
      lossValue: toNumber(batch.purchasePrice) * (batch.quantity + batch.freeQuantity),
    })),
    meta: buildMeta(page, limit, total),
  };
}

// ---------------------------------------------------------------------------
// Transactions & valuation
// ---------------------------------------------------------------------------

export async function listTransactions(owner: StockOwner, query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.InventoryTransactionWhereInput = {
    ...ownerFilter(owner),
    ...(query.productId ? { productId: query.productId as string } : {}),
    ...(query.type ? { type: query.type as never } : {}),
    ...(query.referenceId ? { referenceId: query.referenceId as string } : {}),
  };

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom ? { gte: startOfDay(query.dateFrom as Date) } : {}),
      ...(query.dateTo ? { lte: endOfDay(query.dateTo as Date) } : {}),
    };
  }

  const [items, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        batch: { select: { id: true, batchNumber: true, expiryDate: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.inventoryTransaction.count({ where }),
  ]);

  return { items, meta: buildMeta(page, limit, total) };
}

export async function stockValuation(owner: StockOwner) {
  const rows = await prisma.$queryRaw<
    { totalBatches: bigint; totalUnits: string; costValue: string; mrpValue: string }[]
  >`
    SELECT COUNT(*) AS totalBatches,
           COALESCE(SUM(quantity + freeQuantity), 0) AS totalUnits,
           COALESCE(SUM(purchasePrice * (quantity + freeQuantity)), 0) AS costValue,
           COALESCE(SUM(mrp * (quantity + freeQuantity)), 0) AS mrpValue
    FROM inventory_batches
    WHERE quantity > 0 AND status = 'ACTIVE'
      AND ${owner.ownerType === 'VENDOR' ? Prisma.sql`vendorId = ${owner.vendorId}` : Prisma.sql`retailerId = ${owner.retailerId}`}`;

  const row = rows[0];
  return {
    totalBatches: Number(row?.totalBatches ?? 0),
    totalUnits: Number(row?.totalUnits ?? 0),
    costValue: Number(row?.costValue ?? 0),
    mrpValue: Number(row?.mrpValue ?? 0),
    potentialMargin: Number(row?.mrpValue ?? 0) - Number(row?.costValue ?? 0),
  };
}

export async function lowStockItems(owner: StockOwner, limit = 20) {
  return prisma.$queryRaw<
    { productId: string; name: string; sku: string; availableQty: number; minStockAlert: number }[]
  >`
    SELECT i.productId, p.name, p.sku, i.availableQty, i.minStockAlert
    FROM inventory i
    JOIN products p ON p.id = i.productId
    JOIN warehouses w ON w.id = i.warehouseId
    WHERE i.availableQty <= i.minStockAlert
      AND ${owner.ownerType === 'VENDOR' ? Prisma.sql`w.vendorId = ${owner.vendorId}` : Prisma.sql`w.retailerId = ${owner.retailerId}`}
    ORDER BY i.availableQty ASC
    LIMIT ${limit}`;
}

/**
 * Sales-velocity reorder suggestions (TASKS.md #31) — distinct from the
 * static `minStockAlert` threshold above: flags products that, at their
 * actual last-30-day sale rate, will run dry before a typical reorder lead
 * time, even if they haven't crossed the fixed low-stock line yet.
 */
const VELOCITY_WINDOW_DAYS = 30;
const REORDER_LEAD_TIME_DAYS = 7;

export async function reorderSuggestions(owner: StockOwner, limit = 20) {
  const since = dayjs().subtract(VELOCITY_WINDOW_DAYS, 'day').toDate();

  const sales = await prisma.$queryRaw<{ productId: string; name: string; sku: string; unitsSold: string }[]>`
    SELECT t.productId, p.name, p.sku, SUM(t.quantity) AS unitsSold
    FROM inventory_transactions t
    JOIN products p ON p.id = t.productId
    WHERE t.type = 'SALE' AND t.direction = 'OUT' AND t.createdAt >= ${since}
      AND ${owner.ownerType === 'VENDOR' ? Prisma.sql`t.vendorId = ${owner.vendorId}` : Prisma.sql`t.retailerId = ${owner.retailerId}`}
    GROUP BY t.productId, p.name, p.sku`;
  if (sales.length === 0) return [];

  const productIds = sales.map((row) => row.productId);
  const stockRows = await prisma.$queryRaw<{ productId: string; availableQty: string }[]>`
    SELECT i.productId, SUM(i.availableQty) AS availableQty
    FROM inventory i
    JOIN warehouses w ON w.id = i.warehouseId
    WHERE i.productId IN (${Prisma.join(productIds)})
      AND ${owner.ownerType === 'VENDOR' ? Prisma.sql`w.vendorId = ${owner.vendorId}` : Prisma.sql`w.retailerId = ${owner.retailerId}`}
    GROUP BY i.productId`;
  const stockByProduct = new Map(stockRows.map((row) => [row.productId, Number(row.availableQty)]));

  return sales
    .map((row) => {
      const unitsSold = Number(row.unitsSold);
      const velocityPerDay = unitsSold / VELOCITY_WINDOW_DAYS;
      const availableQty = stockByProduct.get(row.productId) ?? 0;
      const daysOfStockLeft = velocityPerDay > 0 ? availableQty / velocityPerDay : Infinity;
      return {
        productId: row.productId,
        name: row.name,
        sku: row.sku,
        availableQty,
        unitsSoldLast30Days: unitsSold,
        velocityPerDay: Math.round(velocityPerDay * 100) / 100,
        daysOfStockLeft: Number.isFinite(daysOfStockLeft) ? Math.round(daysOfStockLeft * 10) / 10 : null,
      };
    })
    .filter((row) => row.daysOfStockLeft !== null && row.daysOfStockLeft < REORDER_LEAD_TIME_DAYS)
    .sort((a, b) => (a.daysOfStockLeft ?? 0) - (b.daysOfStockLeft ?? 0))
    .slice(0, limit);
}


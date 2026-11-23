import { Prisma } from '@prisma/client';
import type { BatchStatus, InventoryTxnType, OwnerType, StockDirection } from '@prisma/client';
import { prisma, type PrismaTx } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { D, round2 } from '../../utils/money';
import { toDateOnly } from '../../utils/time';

export interface StockOwner {
  ownerType: OwnerType;
  vendorId?: string | null;
  retailerId?: string | null;
}

export interface MovementContext {
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  performedById?: string;
}

export interface BatchInput {
  productId: string;
  batchNumber: string;
  quantity: number;
  freeQuantity?: number;
  purchasePrice?: number | string;
  sellingPrice?: number | string;
  mrp?: number | string;
  gstRate?: number | string;
  manufacturingDate?: Date | string | null;
  expiryDate: Date | string;
  supplierName?: string | null;
  supplierVendorId?: string | null;
}

/** Resolves the owner's default warehouse, creating one if it is missing. */
export async function resolveWarehouse(
  tx: PrismaTx,
  owner: StockOwner,
  warehouseId?: string,
): Promise<string> {
  if (warehouseId) {
    const warehouse = await tx.warehouse.findFirst({
      where: {
        id: warehouseId,
        isActive: true,
        ...(owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId }),
      },
      select: { id: true },
    });
    if (!warehouse) throw ApiError.badRequest('Warehouse not found for this account');
    return warehouse.id;
  }

  const existing = await tx.warehouse.findFirst({
    where:
      owner.ownerType === 'VENDOR'
        ? { vendorId: owner.vendorId, isActive: true }
        : { retailerId: owner.retailerId, isActive: true },
    orderBy: { isDefault: 'desc' },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.warehouse.create({
    data: {
      ownerType: owner.ownerType,
      vendorId: owner.vendorId ?? null,
      retailerId: owner.retailerId ?? null,
      name: owner.ownerType === 'VENDOR' ? 'Main Warehouse' : 'Store',
      code: owner.ownerType === 'VENDOR' ? 'MAIN' : 'STORE',
      isDefault: true,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Every active warehouse an owner has — used to fulfil an order by searching
 * across *all* of a business's locations rather than only its default
 * warehouse (a multi-warehouse vendor/retailer previously failed orders with
 * "insufficient stock" whenever the requested product happened to be sitting
 * in a non-default warehouse, even with plenty of stock elsewhere).
 */
export async function listActiveWarehouseIds(tx: PrismaTx, owner: StockOwner): Promise<string[]> {
  const warehouses = await tx.warehouse.findMany({
    where:
      owner.ownerType === 'VENDOR'
        ? { vendorId: owner.vendorId, isActive: true }
        : { retailerId: owner.retailerId, isActive: true },
    select: { id: true },
  });
  if (warehouses.length > 0) return warehouses.map((w) => w.id);

  // No warehouse exists yet for this owner — resolveWarehouse's own
  // fallback creates the default one, so route through it for that case only.
  return [await resolveWarehouse(tx, owner)];
}

/**
 * Total sellable quantity for a product across every one of the owner's
 * warehouses (active or not — mirrors `stockByProduct` in vendor.service.ts).
 * Read outside any transaction, as a "before" snapshot callers take right
 * before a stock-in, to detect a 0 → positive restock transition (TASKS.md #28).
 */
export async function totalAvailableQty(owner: StockOwner, productId: string): Promise<number> {
  const result = await prisma.inventory.aggregate({
    where: {
      productId,
      warehouse:
        owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId },
    },
    _sum: { availableQty: true },
  });
  return result._sum.availableQty ?? 0;
}

/**
 * Recomputes the aggregate `inventory` row for a product from its batches.
 * Called after every batch mutation so reads never need to scan batches.
 */
async function syncInventory(tx: PrismaTx, warehouseId: string, productId: string): Promise<void> {
  const aggregate = await tx.inventoryBatch.aggregate({
    where: { warehouseId, productId, status: { in: ['ACTIVE', 'EXPIRED', 'BLOCKED'] } },
    _sum: { quantity: true, freeQuantity: true, reservedQty: true },
  });

  const sellable = await tx.inventoryBatch.aggregate({
    where: { warehouseId, productId, status: 'ACTIVE', expiryDate: { gt: new Date() } },
    _sum: { quantity: true, freeQuantity: true, reservedQty: true },
  });

  const totalQty =
    (aggregate._sum.quantity ?? 0) + (aggregate._sum.freeQuantity ?? 0);
  const reservedQty = aggregate._sum.reservedQty ?? 0;
  const sellableQty =
    (sellable._sum.quantity ?? 0) + (sellable._sum.freeQuantity ?? 0) - (sellable._sum.reservedQty ?? 0);

  await tx.inventory.upsert({
    where: { warehouseId_productId: { warehouseId, productId } },
    update: {
      totalQty,
      reservedQty,
      availableQty: Math.max(0, sellableQty),
    },
    create: {
      warehouseId,
      productId,
      totalQty,
      reservedQty,
      availableQty: Math.max(0, sellableQty),
    },
  });
}

/** Writes the immutable stock-movement record required for every change. */
async function writeTransaction(
  tx: PrismaTx,
  args: {
    warehouseId: string;
    productId: string;
    batchId?: string | null;
    owner: StockOwner;
    type: InventoryTxnType;
    direction: StockDirection;
    quantity: number;
    balanceAfter?: number;
    unitCost?: Prisma.Decimal | number | string | null;
    context?: MovementContext;
  },
): Promise<void> {
  const unitCost = args.unitCost === undefined || args.unitCost === null ? null : round2(args.unitCost);

  await tx.inventoryTransaction.create({
    data: {
      warehouseId: args.warehouseId,
      productId: args.productId,
      batchId: args.batchId ?? null,
      ownerType: args.owner.ownerType,
      vendorId: args.owner.vendorId ?? null,
      retailerId: args.owner.retailerId ?? null,
      type: args.type,
      direction: args.direction,
      quantity: args.quantity,
      balanceAfter: args.balanceAfter ?? null,
      unitCost,
      totalCost: unitCost ? round2(unitCost.mul(args.quantity)) : null,
      referenceType: args.context?.referenceType ?? null,
      referenceId: args.context?.referenceId ?? null,
      notes: args.context?.notes ?? null,
      performedById: args.context?.performedById ?? null,
    },
  });
}

/**
 * Adds stock into a batch (creating it when new) and records the transaction.
 * Used by purchases, opening stock, returns and manual additions.
 */
export async function stockIn(
  tx: PrismaTx,
  owner: StockOwner,
  warehouseId: string,
  input: BatchInput,
  type: InventoryTxnType,
  context?: MovementContext,
): Promise<{ batchId: string }> {
  if (input.quantity <= 0 && (input.freeQuantity ?? 0) <= 0) {
    throw ApiError.badRequest('Quantity must be greater than zero');
  }

  const expiryDate = toDateOnly(input.expiryDate);
  if (expiryDate <= new Date()) {
    throw ApiError.badRequest(`Batch ${input.batchNumber} has already expired and cannot be added to stock`);
  }

  const existing = await tx.inventoryBatch.findUnique({
    where: {
      warehouseId_productId_batchNumber: {
        warehouseId,
        productId: input.productId,
        batchNumber: input.batchNumber,
      },
    },
  });

  const batch = existing
    ? await tx.inventoryBatch.update({
        where: { id: existing.id },
        data: {
          quantity: { increment: input.quantity },
          freeQuantity: { increment: input.freeQuantity ?? 0 },
          // Latest purchase terms win so valuation follows the newest receipt.
          purchasePrice: input.purchasePrice !== undefined ? D(input.purchasePrice) : existing.purchasePrice,
          sellingPrice: input.sellingPrice !== undefined ? D(input.sellingPrice) : existing.sellingPrice,
          mrp: input.mrp !== undefined ? D(input.mrp) : existing.mrp,
          gstRate: input.gstRate !== undefined ? D(input.gstRate) : existing.gstRate,
          status: 'ACTIVE',
        },
      })
    : await tx.inventoryBatch.create({
        data: {
          warehouseId,
          productId: input.productId,
          ownerType: owner.ownerType,
          vendorId: owner.vendorId ?? null,
          retailerId: owner.retailerId ?? null,
          batchNumber: input.batchNumber,
          quantity: input.quantity,
          freeQuantity: input.freeQuantity ?? 0,
          purchasePrice: D(input.purchasePrice ?? 0),
          sellingPrice: D(input.sellingPrice ?? 0),
          mrp: D(input.mrp ?? 0),
          gstRate: D(input.gstRate ?? 0),
          manufacturingDate: input.manufacturingDate ? toDateOnly(input.manufacturingDate) : null,
          expiryDate,
          supplierName: input.supplierName ?? null,
          supplierVendorId: input.supplierVendorId ?? null,
          status: 'ACTIVE',
        },
      });

  await writeTransaction(tx, {
    warehouseId,
    productId: input.productId,
    batchId: batch.id,
    owner,
    type,
    direction: 'IN',
    quantity: input.quantity + (input.freeQuantity ?? 0),
    balanceAfter: batch.quantity + batch.freeQuantity,
    unitCost: input.purchasePrice ?? null,
    context,
  });

  await syncInventory(tx, warehouseId, input.productId);
  return { batchId: batch.id };
}

export interface Allocation {
  batchId: string;
  batchNumber: string;
  warehouseId: string;
  quantity: number;
  purchasePrice: Prisma.Decimal;
  sellingPrice: Prisma.Decimal;
  mrp: Prisma.Decimal;
  expiryDate: Date;
}

/**
 * Picks batches for an outgoing quantity using FEFO (First Expiry, First
 * Out) — searched across every warehouse in `warehouseIds`, not just one, so
 * a multi-warehouse owner's stock is found wherever it actually sits rather
 * than only in whichever warehouse the caller happened to pick. A single
 * order can end up allocated across more than one warehouse; each
 * `Allocation` carries its own `warehouseId` so callers never have to guess
 * which one a given batch came from. Rows are locked FOR UPDATE so two
 * concurrent orders cannot oversell the same batch — this is the guard
 * against overselling required by the spec.
 */
export async function allocateFefo(
  tx: PrismaTx,
  warehouseIds: string[],
  productId: string,
  quantity: number,
): Promise<Allocation[]> {
  if (quantity <= 0) throw ApiError.badRequest('Quantity must be greater than zero');
  if (warehouseIds.length === 0) throw ApiError.badRequest('No active warehouse found for this account');

  const rows = await tx.$queryRaw<
    {
      id: string;
      warehouseId: string;
      batchNumber: string;
      quantity: number;
      freeQuantity: number;
      reservedQty: number;
      purchasePrice: Prisma.Decimal;
      sellingPrice: Prisma.Decimal;
      mrp: Prisma.Decimal;
      expiryDate: Date;
    }[]
  >`
    SELECT id, warehouseId, batchNumber, quantity, freeQuantity, reservedQty, purchasePrice, sellingPrice, mrp, expiryDate
    FROM inventory_batches
    WHERE warehouseId IN (${Prisma.join(warehouseIds)})
      AND productId = ${productId}
      AND status = 'ACTIVE'
      AND expiryDate > CURDATE()
      AND (quantity + freeQuantity - reservedQty) > 0
    ORDER BY expiryDate ASC, createdAt ASC
    FOR UPDATE`;

  const allocations: Allocation[] = [];
  let remaining = quantity;

  for (const row of rows) {
    if (remaining <= 0) break;
    const available = row.quantity + row.freeQuantity - row.reservedQty;
    if (available <= 0) continue;

    const take = Math.min(available, remaining);
    allocations.push({
      batchId: row.id,
      batchNumber: row.batchNumber,
      warehouseId: row.warehouseId,
      quantity: take,
      purchasePrice: row.purchasePrice,
      sellingPrice: row.sellingPrice,
      mrp: row.mrp,
      expiryDate: row.expiryDate,
    });
    remaining -= take;
  }

  if (remaining > 0) {
    const stocked = quantity - remaining;
    throw ApiError.badRequest(
      `Insufficient stock — only ${stocked} unit(s) available against a request for ${quantity}`,
    );
  }

  return allocations;
}

/** Moves allocated quantity from available into reserved — across whichever warehouse(s) each allocation actually came from. */
export async function reserveStock(
  tx: PrismaTx,
  owner: StockOwner,
  productId: string,
  allocations: Allocation[],
  context?: MovementContext,
): Promise<void> {
  const touchedWarehouses = new Set<string>();

  for (const allocation of allocations) {
    await tx.inventoryBatch.update({
      where: { id: allocation.batchId },
      data: { reservedQty: { increment: allocation.quantity } },
    });

    await writeTransaction(tx, {
      warehouseId: allocation.warehouseId,
      productId,
      batchId: allocation.batchId,
      owner,
      type: 'ORDER_RESERVATION',
      direction: 'RESERVE',
      quantity: allocation.quantity,
      unitCost: allocation.purchasePrice,
      context,
    });
    touchedWarehouses.add(allocation.warehouseId);
  }

  for (const warehouseId of touchedWarehouses) {
    await syncInventory(tx, warehouseId, productId);
  }
}

/**
 * Returns reserved quantity to available stock (order cancelled or
 * rejected). Each allocation's own warehouse is read off its batch — the
 * allocation may have come from any of the owner's warehouses.
 */
export async function releaseStock(
  tx: PrismaTx,
  owner: StockOwner,
  productId: string,
  allocations: { batchId: string; quantity: number }[],
  context?: MovementContext,
): Promise<void> {
  const touchedWarehouses = new Set<string>();

  for (const allocation of allocations) {
    const batch = await tx.inventoryBatch.findUnique({
      where: { id: allocation.batchId },
      select: { warehouseId: true, reservedQty: true },
    });
    if (!batch) continue;

    await tx.inventoryBatch.update({
      where: { id: allocation.batchId },
      // Guard against a negative reservation if state ever drifts.
      data: { reservedQty: Math.max(0, batch.reservedQty - allocation.quantity) },
    });

    await writeTransaction(tx, {
      warehouseId: batch.warehouseId,
      productId,
      batchId: allocation.batchId,
      owner,
      type: 'ORDER_RELEASE',
      direction: 'RELEASE',
      quantity: allocation.quantity,
      context,
    });
    touchedWarehouses.add(batch.warehouseId);
  }

  for (const warehouseId of touchedWarehouses) {
    await syncInventory(tx, warehouseId, productId);
  }
}

/**
 * Consumes previously reserved stock: reduces both the batch quantity and its
 * reservation. Used when an order is completed / picked up / delivered.
 * Each allocation's own warehouse is read off its batch, same reasoning as
 * `releaseStock`.
 */
export async function consumeReserved(
  tx: PrismaTx,
  owner: StockOwner,
  productId: string,
  allocations: { batchId: string; quantity: number }[],
  type: InventoryTxnType,
  context?: MovementContext,
): Promise<void> {
  const touchedWarehouses = new Set<string>();

  for (const allocation of allocations) {
    const batch = await tx.inventoryBatch.findUnique({ where: { id: allocation.batchId } });
    if (!batch) continue;

    // Free stock is consumed first so paid quantity stays accurate for costing.
    const fromFree = Math.min(batch.freeQuantity, allocation.quantity);
    const fromPaid = allocation.quantity - fromFree;

    const updated = await tx.inventoryBatch.update({
      where: { id: allocation.batchId },
      data: {
        freeQuantity: Math.max(0, batch.freeQuantity - fromFree),
        quantity: Math.max(0, batch.quantity - fromPaid),
        reservedQty: Math.max(0, batch.reservedQty - allocation.quantity),
      },
    });

    if (updated.quantity + updated.freeQuantity === 0) {
      await tx.inventoryBatch.update({ where: { id: allocation.batchId }, data: { status: 'DEPLETED' } });
    }

    await writeTransaction(tx, {
      warehouseId: batch.warehouseId,
      productId,
      batchId: allocation.batchId,
      owner,
      type,
      direction: 'OUT',
      quantity: allocation.quantity,
      balanceAfter: updated.quantity + updated.freeQuantity,
      unitCost: batch.purchasePrice,
      context,
    });
    touchedWarehouses.add(batch.warehouseId);
  }

  for (const warehouseId of touchedWarehouses) {
    await syncInventory(tx, warehouseId, productId);
  }
}

/**
 * Direct stock-out without a prior reservation (counter sale, damage, expiry
 * write-off, vendor→retailer dispatch). Allocates FEFO across every
 * warehouse in `warehouseIds` and deducts immediately — pass a single
 * warehouse (`[id]`) for a deliberately location-scoped action (e.g. writing
 * off damaged stock found at one specific location), or every active
 * warehouse an owner has (`listActiveWarehouseIds`) to fulfil an order from
 * wherever the stock actually is.
 */
export async function stockOut(
  tx: PrismaTx,
  owner: StockOwner,
  warehouseIds: string[],
  productId: string,
  quantity: number,
  type: InventoryTxnType,
  context?: MovementContext,
): Promise<Allocation[]> {
  const allocations = await allocateFefo(tx, warehouseIds, productId, quantity);
  const touchedWarehouses = new Set<string>();

  for (const allocation of allocations) {
    const batch = await tx.inventoryBatch.findUnique({ where: { id: allocation.batchId } });
    if (!batch) continue;

    const fromFree = Math.min(batch.freeQuantity, allocation.quantity);
    const fromPaid = allocation.quantity - fromFree;

    const updated = await tx.inventoryBatch.update({
      where: { id: allocation.batchId },
      data: {
        freeQuantity: Math.max(0, batch.freeQuantity - fromFree),
        quantity: Math.max(0, batch.quantity - fromPaid),
      },
    });

    if (updated.quantity + updated.freeQuantity === 0) {
      await tx.inventoryBatch.update({ where: { id: allocation.batchId }, data: { status: 'DEPLETED' } });
    }

    await writeTransaction(tx, {
      warehouseId: allocation.warehouseId,
      productId,
      batchId: allocation.batchId,
      owner,
      type,
      direction: 'OUT',
      quantity: allocation.quantity,
      balanceAfter: updated.quantity + updated.freeQuantity,
      unitCost: batch.purchasePrice,
      context,
    });
    touchedWarehouses.add(allocation.warehouseId);
  }

  for (const warehouseId of touchedWarehouses) {
    await syncInventory(tx, warehouseId, productId);
  }
  return allocations;
}

/** Manual correction of a batch quantity, always recorded as an ADJUSTMENT. */
export async function adjustBatch(
  owner: StockOwner,
  batchId: string,
  newQuantity: number,
  reason: string,
  performedById?: string,
) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.inventoryBatch.findFirst({
      where: {
        id: batchId,
        ...(owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId }),
      },
    });
    if (!batch) throw ApiError.notFound('Batch not found');

    const available = batch.quantity + batch.freeQuantity - batch.reservedQty;
    const delta = newQuantity - (batch.quantity + batch.freeQuantity);
    if (delta < 0 && Math.abs(delta) > available) {
      throw ApiError.badRequest(
        `Cannot reduce below reserved stock — ${batch.reservedQty} unit(s) are reserved for open orders`,
      );
    }

    const updated = await tx.inventoryBatch.update({
      where: { id: batchId },
      data: {
        quantity: Math.max(0, newQuantity - batch.freeQuantity),
        status: newQuantity === 0 ? 'DEPLETED' : 'ACTIVE',
      },
    });

    await writeTransaction(tx, {
      warehouseId: batch.warehouseId,
      productId: batch.productId,
      batchId,
      owner,
      type: 'ADJUSTMENT',
      direction: delta >= 0 ? 'IN' : 'OUT',
      quantity: Math.abs(delta),
      balanceAfter: updated.quantity + updated.freeQuantity,
      unitCost: batch.purchasePrice,
      context: { notes: reason, performedById, referenceType: 'ADJUSTMENT' },
    });

    await syncInventory(tx, batch.warehouseId, batch.productId);
    return updated;
  });
}

export async function setBatchStatus(owner: StockOwner, batchId: string, status: BatchStatus) {
  const batch = await prisma.inventoryBatch.findFirst({
    where: {
      id: batchId,
      ...(owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId }),
    },
  });
  if (!batch) throw ApiError.notFound('Batch not found');

  const updated = await prisma.inventoryBatch.update({ where: { id: batchId }, data: { status } });
  await prisma.$transaction(async (tx) => syncInventory(tx, batch.warehouseId, batch.productId));
  return updated;
}

/** Re-derives every aggregate row for an owner — used by maintenance jobs. */
export async function resyncOwnerInventory(owner: StockOwner): Promise<number> {
  const batches = await prisma.inventoryBatch.findMany({
    where: owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId },
    select: { warehouseId: true, productId: true },
    distinct: ['warehouseId', 'productId'],
  });

  for (const batch of batches) {
    await prisma.$transaction(async (tx) => syncInventory(tx, batch.warehouseId, batch.productId));
  }
  return batches.length;
}

export { syncInventory };

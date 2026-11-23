"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveWarehouse = resolveWarehouse;
exports.stockIn = stockIn;
exports.allocateFefo = allocateFefo;
exports.reserveStock = reserveStock;
exports.releaseStock = releaseStock;
exports.consumeReserved = consumeReserved;
exports.stockOut = stockOut;
exports.adjustBatch = adjustBatch;
exports.setBatchStatus = setBatchStatus;
exports.resyncOwnerInventory = resyncOwnerInventory;
exports.syncInventory = syncInventory;
const prisma_1 = require("../../database/prisma");
const ApiError_1 = require("../../utils/ApiError");
const money_1 = require("../../utils/money");
const time_1 = require("../../utils/time");
/** Resolves the owner's default warehouse, creating one if it is missing. */
async function resolveWarehouse(tx, owner, warehouseId) {
    if (warehouseId) {
        const warehouse = await tx.warehouse.findFirst({
            where: {
                id: warehouseId,
                isActive: true,
                ...(owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId }),
            },
            select: { id: true },
        });
        if (!warehouse)
            throw ApiError_1.ApiError.badRequest('Warehouse not found for this account');
        return warehouse.id;
    }
    const existing = await tx.warehouse.findFirst({
        where: owner.ownerType === 'VENDOR'
            ? { vendorId: owner.vendorId, isActive: true }
            : { retailerId: owner.retailerId, isActive: true },
        orderBy: { isDefault: 'desc' },
        select: { id: true },
    });
    if (existing)
        return existing.id;
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
 * Recomputes the aggregate `inventory` row for a product from its batches.
 * Called after every batch mutation so reads never need to scan batches.
 */
async function syncInventory(tx, warehouseId, productId) {
    const aggregate = await tx.inventoryBatch.aggregate({
        where: { warehouseId, productId, status: { in: ['ACTIVE', 'EXPIRED', 'BLOCKED'] } },
        _sum: { quantity: true, freeQuantity: true, reservedQty: true },
    });
    const sellable = await tx.inventoryBatch.aggregate({
        where: { warehouseId, productId, status: 'ACTIVE', expiryDate: { gt: new Date() } },
        _sum: { quantity: true, freeQuantity: true, reservedQty: true },
    });
    const totalQty = (aggregate._sum.quantity ?? 0) + (aggregate._sum.freeQuantity ?? 0);
    const reservedQty = aggregate._sum.reservedQty ?? 0;
    const sellableQty = (sellable._sum.quantity ?? 0) + (sellable._sum.freeQuantity ?? 0) - (sellable._sum.reservedQty ?? 0);
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
async function writeTransaction(tx, args) {
    const unitCost = args.unitCost === undefined || args.unitCost === null ? null : (0, money_1.round2)(args.unitCost);
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
            totalCost: unitCost ? (0, money_1.round2)(unitCost.mul(args.quantity)) : null,
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
async function stockIn(tx, owner, warehouseId, input, type, context) {
    if (input.quantity <= 0 && (input.freeQuantity ?? 0) <= 0) {
        throw ApiError_1.ApiError.badRequest('Quantity must be greater than zero');
    }
    const expiryDate = (0, time_1.toDateOnly)(input.expiryDate);
    if (expiryDate <= new Date()) {
        throw ApiError_1.ApiError.badRequest(`Batch ${input.batchNumber} has already expired and cannot be added to stock`);
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
                purchasePrice: input.purchasePrice !== undefined ? (0, money_1.D)(input.purchasePrice) : existing.purchasePrice,
                sellingPrice: input.sellingPrice !== undefined ? (0, money_1.D)(input.sellingPrice) : existing.sellingPrice,
                mrp: input.mrp !== undefined ? (0, money_1.D)(input.mrp) : existing.mrp,
                gstRate: input.gstRate !== undefined ? (0, money_1.D)(input.gstRate) : existing.gstRate,
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
                purchasePrice: (0, money_1.D)(input.purchasePrice ?? 0),
                sellingPrice: (0, money_1.D)(input.sellingPrice ?? 0),
                mrp: (0, money_1.D)(input.mrp ?? 0),
                gstRate: (0, money_1.D)(input.gstRate ?? 0),
                manufacturingDate: input.manufacturingDate ? (0, time_1.toDateOnly)(input.manufacturingDate) : null,
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
/**
 * Picks batches for an outgoing quantity using FEFO (First Expiry, First Out).
 * Rows are locked FOR UPDATE so two concurrent orders cannot oversell the same
 * batch — this is the guard against overselling required by the spec.
 */
async function allocateFefo(tx, warehouseId, productId, quantity) {
    if (quantity <= 0)
        throw ApiError_1.ApiError.badRequest('Quantity must be greater than zero');
    const rows = await tx.$queryRaw `
    SELECT id, batchNumber, quantity, freeQuantity, reservedQty, purchasePrice, sellingPrice, mrp, expiryDate
    FROM inventory_batches
    WHERE warehouseId = ${warehouseId}
      AND productId = ${productId}
      AND status = 'ACTIVE'
      AND expiryDate > CURDATE()
      AND (quantity + freeQuantity - reservedQty) > 0
    ORDER BY expiryDate ASC, createdAt ASC
    FOR UPDATE`;
    const allocations = [];
    let remaining = quantity;
    for (const row of rows) {
        if (remaining <= 0)
            break;
        const available = row.quantity + row.freeQuantity - row.reservedQty;
        if (available <= 0)
            continue;
        const take = Math.min(available, remaining);
        allocations.push({
            batchId: row.id,
            batchNumber: row.batchNumber,
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
        throw ApiError_1.ApiError.badRequest(`Insufficient stock — only ${stocked} unit(s) available against a request for ${quantity}`);
    }
    return allocations;
}
/** Moves allocated quantity from available into reserved. */
async function reserveStock(tx, owner, warehouseId, productId, allocations, context) {
    for (const allocation of allocations) {
        await tx.inventoryBatch.update({
            where: { id: allocation.batchId },
            data: { reservedQty: { increment: allocation.quantity } },
        });
        await writeTransaction(tx, {
            warehouseId,
            productId,
            batchId: allocation.batchId,
            owner,
            type: 'ORDER_RESERVATION',
            direction: 'RESERVE',
            quantity: allocation.quantity,
            unitCost: allocation.purchasePrice,
            context,
        });
    }
    await syncInventory(tx, warehouseId, productId);
}
/** Returns reserved quantity to available stock (order cancelled or rejected). */
async function releaseStock(tx, owner, warehouseId, productId, allocations, context) {
    for (const allocation of allocations) {
        const batch = await tx.inventoryBatch.findUnique({
            where: { id: allocation.batchId },
            select: { reservedQty: true },
        });
        if (!batch)
            continue;
        await tx.inventoryBatch.update({
            where: { id: allocation.batchId },
            // Guard against a negative reservation if state ever drifts.
            data: { reservedQty: Math.max(0, batch.reservedQty - allocation.quantity) },
        });
        await writeTransaction(tx, {
            warehouseId,
            productId,
            batchId: allocation.batchId,
            owner,
            type: 'ORDER_RELEASE',
            direction: 'RELEASE',
            quantity: allocation.quantity,
            context,
        });
    }
    await syncInventory(tx, warehouseId, productId);
}
/**
 * Consumes previously reserved stock: reduces both the batch quantity and its
 * reservation. Used when an order is completed / picked up.
 */
async function consumeReserved(tx, owner, warehouseId, productId, allocations, type, context) {
    for (const allocation of allocations) {
        const batch = await tx.inventoryBatch.findUnique({ where: { id: allocation.batchId } });
        if (!batch)
            continue;
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
            warehouseId,
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
    }
    await syncInventory(tx, warehouseId, productId);
}
/**
 * Direct stock-out without a prior reservation (counter sale, damage, expiry
 * write-off). Allocates FEFO and deducts immediately.
 */
async function stockOut(tx, owner, warehouseId, productId, quantity, type, context) {
    const allocations = await allocateFefo(tx, warehouseId, productId, quantity);
    for (const allocation of allocations) {
        const batch = await tx.inventoryBatch.findUnique({ where: { id: allocation.batchId } });
        if (!batch)
            continue;
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
            warehouseId,
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
    }
    await syncInventory(tx, warehouseId, productId);
    return allocations;
}
/** Manual correction of a batch quantity, always recorded as an ADJUSTMENT. */
async function adjustBatch(owner, batchId, newQuantity, reason, performedById) {
    return prisma_1.prisma.$transaction(async (tx) => {
        const batch = await tx.inventoryBatch.findFirst({
            where: {
                id: batchId,
                ...(owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId }),
            },
        });
        if (!batch)
            throw ApiError_1.ApiError.notFound('Batch not found');
        const available = batch.quantity + batch.freeQuantity - batch.reservedQty;
        const delta = newQuantity - (batch.quantity + batch.freeQuantity);
        if (delta < 0 && Math.abs(delta) > available) {
            throw ApiError_1.ApiError.badRequest(`Cannot reduce below reserved stock — ${batch.reservedQty} unit(s) are reserved for open orders`);
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
async function setBatchStatus(owner, batchId, status) {
    const batch = await prisma_1.prisma.inventoryBatch.findFirst({
        where: {
            id: batchId,
            ...(owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId }),
        },
    });
    if (!batch)
        throw ApiError_1.ApiError.notFound('Batch not found');
    const updated = await prisma_1.prisma.inventoryBatch.update({ where: { id: batchId }, data: { status } });
    await prisma_1.prisma.$transaction(async (tx) => syncInventory(tx, batch.warehouseId, batch.productId));
    return updated;
}
/** Re-derives every aggregate row for an owner — used by maintenance jobs. */
async function resyncOwnerInventory(owner) {
    const batches = await prisma_1.prisma.inventoryBatch.findMany({
        where: owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId },
        select: { warehouseId: true, productId: true },
        distinct: ['warehouseId', 'productId'],
    });
    for (const batch of batches) {
        await prisma_1.prisma.$transaction(async (tx) => syncInventory(tx, batch.warehouseId, batch.productId));
    }
    return batches.length;
}
//# sourceMappingURL=inventory.service.js.map
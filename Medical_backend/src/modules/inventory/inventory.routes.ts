import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, ok, paginated } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/rbac';
import { auditFromRequest } from '../../lib/audit';
import { AUDIT_MODULES } from '../../config/constants';
import { PERMISSIONS } from '../../config/permissions';
import { idParam } from '../../common/query.validation';
import { doc } from '../../lib/openapi';
import { notifyBackInStock } from '../notifications/notification.service';
import * as inventory from './inventory.service';
import * as query from './inventory.query';
import type { StockOwner } from './inventory.service';
import {
  addStockSchema,
  adjustStockSchema,
  batchStatusSchema,
  stockListQuery,
  stockSummaryQuery,
  transactionListQuery,
  warehouseCreateSchema,
  warehouseUpdateSchema,
  writeOffSchema,
} from './inventory.validation';

/**
 * Inventory endpoints are identical for vendors and retailers — only the owner
 * scope differs. Both mount this router with their own scope resolver.
 */
export function createInventoryRouter(resolveOwner: (req: Request) => StockOwner, tag: string): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  router.get(
    '/batches',
    requirePermission(PERMISSIONS.STOCK_VIEW),
    validate({ query: stockListQuery }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await query.listStock(resolveOwner(req), req.query as Record<string, unknown>);
      return paginated(res, items, meta);
    }),
  );

  router.get(
    '/summary',
    requirePermission(PERMISSIONS.STOCK_VIEW),
    validate({ query: stockSummaryQuery }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await query.listStockSummary(
        resolveOwner(req),
        req.query as Record<string, unknown>,
      );
      return paginated(res, items, meta);
    }),
  );

  router.get(
    '/valuation',
    requirePermission(PERMISSIONS.STOCK_VIEW),
    asyncHandler(async (req, res) => ok(res, await query.stockValuation(resolveOwner(req)))),
  );

  router.get(
    '/low-stock',
    requirePermission(PERMISSIONS.STOCK_VIEW),
    validate({ query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }) }),
    asyncHandler(async (req, res) =>
      ok(res, await query.lowStockItems(resolveOwner(req), Number(req.query.limit ?? 20))),
    ),
  );

  router.get(
    '/reorder-suggestions',
    requirePermission(PERMISSIONS.STOCK_VIEW),
    validate({ query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }) }),
    asyncHandler(async (req, res) =>
      ok(res, await query.reorderSuggestions(resolveOwner(req), Number(req.query.limit ?? 20))),
    ),
  );

  router.get(
    '/expiry-summary',
    requirePermission(PERMISSIONS.STOCK_VIEW),
    asyncHandler(async (req, res) => ok(res, await query.expirySummary(resolveOwner(req)))),
  );

  router.get(
    '/expiring',
    requirePermission(PERMISSIONS.STOCK_VIEW),
    validate({ query: stockListQuery.extend({ days: z.coerce.number().int().min(1).max(365).default(30) }) }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await query.listExpiring(
        resolveOwner(req),
        Number(req.query.days ?? 30),
        req.query as Record<string, unknown>,
      );
      return paginated(res, items, meta);
    }),
  );

  router.get(
    '/expired',
    requirePermission(PERMISSIONS.STOCK_VIEW),
    validate({ query: stockListQuery }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await query.listExpired(resolveOwner(req), req.query as Record<string, unknown>);
      return paginated(res, items, meta);
    }),
  );

  router.get(
    '/transactions',
    requirePermission(PERMISSIONS.STOCK_VIEW),
    validate({ query: transactionListQuery }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await query.listTransactions(
        resolveOwner(req),
        req.query as Record<string, unknown>,
      );
      return paginated(res, items, meta);
    }),
  );

  // -------------------------------------------------------------------------
  // Writes — every one produces an inventory transaction
  // -------------------------------------------------------------------------

  router.post(
    '/batches',
    requirePermission(PERMISSIONS.STOCK_MANAGE),
    validate({ body: addStockSchema }),
    asyncHandler(async (req, res) => {
      const owner = resolveOwner(req);
      const wasOutOfStock =
        owner.ownerType === 'RETAILER' &&
        (await inventory.totalAvailableQty(owner, req.body.productId)) <= 0;

      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: req.body.productId, deletedAt: null },
          select: { id: true, status: true, isRecalled: true },
        });
        if (!product) throw ApiError.badRequest('Product not found in the master catalogue');
        if (product.status === 'BLOCKED' || product.isRecalled) {
          throw ApiError.badRequest('This product is blocked or recalled and cannot be stocked');
        }

        const warehouseId = await inventory.resolveWarehouse(tx, owner, req.body.warehouseId);
        return inventory.stockIn(tx, owner, warehouseId, req.body, 'OPENING_STOCK', {
          referenceType: 'MANUAL',
          notes: req.body.notes,
          performedById: req.user!.id,
        });
      });

      await auditFromRequest(req, {
        action: 'stock.add',
        module: AUDIT_MODULES.INVENTORY,
        recordId: result.batchId,
        newValue: req.body,
      });

      if (wasOutOfStock && owner.ownerType === 'RETAILER') {
        await notifyBackInStock(owner.retailerId!, req.body.productId);
      }

      return created(res, result, 'Stock added');
    }),
  );

  router.patch(
    '/batches/:id/adjust',
    requirePermission(PERMISSIONS.STOCK_MANAGE),
    validate({ params: idParam, body: adjustStockSchema }),
    asyncHandler(async (req, res) => {
      const batch = await inventory.adjustBatch(
        resolveOwner(req),
        req.params.id,
        req.body.quantity,
        req.body.reason,
        req.user!.id,
      );
      await auditFromRequest(req, {
        action: 'stock.adjust',
        module: AUDIT_MODULES.INVENTORY,
        recordId: req.params.id,
        newValue: { quantity: req.body.quantity, reason: req.body.reason },
      });
      return ok(res, batch, 'Stock adjusted');
    }),
  );

  router.patch(
    '/batches/:id/status',
    requirePermission(PERMISSIONS.STOCK_MANAGE),
    validate({ params: idParam, body: batchStatusSchema }),
    asyncHandler(async (req, res) => {
      const batch = await inventory.setBatchStatus(resolveOwner(req), req.params.id, req.body.status);
      await auditFromRequest(req, {
        action: 'stock.batch_status',
        module: AUDIT_MODULES.INVENTORY,
        recordId: req.params.id,
        newValue: { status: req.body.status },
      });
      return ok(res, batch, 'Batch status updated');
    }),
  );

  router.post(
    '/write-off',
    requirePermission(PERMISSIONS.STOCK_MANAGE),
    validate({ body: writeOffSchema }),
    asyncHandler(async (req, res) => {
      const owner = resolveOwner(req);

      const allocations = await prisma.$transaction(async (tx) => {
        const warehouseId = await inventory.resolveWarehouse(tx, owner, req.body.warehouseId);
        return inventory.stockOut(
          tx,
          owner,
          [warehouseId],
          req.body.productId,
          req.body.quantity,
          req.body.type,
          { referenceType: 'WRITE_OFF', notes: req.body.reason, performedById: req.user!.id },
        );
      });

      await auditFromRequest(req, {
        action: `stock.${req.body.type.toLowerCase()}`,
        module: AUDIT_MODULES.INVENTORY,
        recordId: req.body.productId,
        newValue: req.body,
      });
      return ok(res, allocations, 'Stock written off');
    }),
  );

  // -------------------------------------------------------------------------
  // Warehouses
  // -------------------------------------------------------------------------

  router.get(
    '/warehouses',
    requirePermission(PERMISSIONS.STOCK_VIEW),
    asyncHandler(async (req, res) => {
      const owner = resolveOwner(req);
      const warehouses = await prisma.warehouse.findMany({
        where: owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });
      return ok(res, warehouses);
    }),
  );

  router.post(
    '/warehouses',
    requirePermission(PERMISSIONS.STOCK_MANAGE),
    validate({ body: warehouseCreateSchema }),
    asyncHandler(async (req, res) => {
      const owner = resolveOwner(req);
      const scopeWhere = owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId };
      const warehouse = await prisma.$transaction(async (tx) => {
        // Only one warehouse per owner may be the default — clear any existing
        // one first so `resolveWarehouse`'s `orderBy: isDefault desc` fallback
        // (used whenever a caller doesn't pass a warehouseId) stays unambiguous.
        if (req.body.isDefault) {
          await tx.warehouse.updateMany({ where: { ...scopeWhere, isDefault: true }, data: { isDefault: false } });
        }
        return tx.warehouse.create({
          data: {
            ...req.body,
            ownerType: owner.ownerType,
            vendorId: owner.vendorId ?? null,
            retailerId: owner.retailerId ?? null,
          },
        });
      });
      return created(res, warehouse, 'Warehouse created');
    }),
  );

  router.put(
    '/warehouses/:id',
    requirePermission(PERMISSIONS.STOCK_MANAGE),
    validate({ params: idParam, body: warehouseUpdateSchema }),
    asyncHandler(async (req, res) => {
      const owner = resolveOwner(req);
      const scopeWhere = owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId };
      const existing = await prisma.warehouse.findFirst({
        where: { id: req.params.id, ...scopeWhere },
        select: { id: true },
      });
      if (!existing) throw ApiError.notFound('Warehouse not found');

      const warehouse = await prisma.$transaction(async (tx) => {
        if (req.body.isDefault) {
          await tx.warehouse.updateMany({
            where: { ...scopeWhere, isDefault: true, id: { not: req.params.id } },
            data: { isDefault: false },
          });
        }
        return tx.warehouse.update({ where: { id: req.params.id }, data: req.body });
      });
      return ok(res, warehouse, 'Warehouse updated');
    }),
  );

  // -------------------------------------------------------------------------
  // OpenAPI
  // -------------------------------------------------------------------------

  const base = tag === 'Vendor' ? '/vendor/inventory' : '/retailer/inventory';
  doc('get', `${base}/batches`, { tags: [tag, 'Inventory'], summary: 'List stock batches', query: stockListQuery, paginated: true });
  doc('get', `${base}/summary`, { tags: [tag, 'Inventory'], summary: 'Product-wise stock position', query: stockSummaryQuery, paginated: true });
  doc('get', `${base}/valuation`, { tags: [tag, 'Inventory'], summary: 'Stock valuation totals' });
  doc('get', `${base}/low-stock`, { tags: [tag, 'Inventory'], summary: 'Products at or below the minimum stock level' });
  doc('get', `${base}/reorder-suggestions`, { tags: [tag, 'Inventory'], summary: 'Products that will run out before a typical reorder lead time, based on 30-day sale velocity' });
  doc('get', `${base}/expiry-summary`, { tags: [tag, 'Inventory'], summary: 'Expired / 30 / 60 / 90 day expiry counts' });
  doc('get', `${base}/expiring`, { tags: [tag, 'Inventory'], summary: 'Batches expiring within N days', query: stockListQuery, paginated: true });
  doc('get', `${base}/expired`, { tags: [tag, 'Inventory'], summary: 'Expired batches still holding stock', query: stockListQuery, paginated: true });
  doc('get', `${base}/transactions`, { tags: [tag, 'Inventory'], summary: 'Stock movement ledger', query: transactionListQuery, paginated: true });
  doc('post', `${base}/batches`, { tags: [tag, 'Inventory'], summary: 'Add stock into a batch', body: addStockSchema });
  doc('patch', `${base}/batches/{id}/adjust`, { tags: [tag, 'Inventory'], summary: 'Adjust a batch quantity', params: idParam, body: adjustStockSchema, status: 200 });
  doc('patch', `${base}/batches/{id}/status`, { tags: [tag, 'Inventory'], summary: 'Block / unblock a batch', params: idParam, body: batchStatusSchema, status: 200 });
  doc('post', `${base}/write-off`, { tags: [tag, 'Inventory'], summary: 'Write off damaged or expired stock', body: writeOffSchema, status: 200 });
  doc('get', `${base}/warehouses`, { tags: [tag, 'Inventory'], summary: 'List warehouses / store locations' });
  doc('post', `${base}/warehouses`, { tags: [tag, 'Inventory'], summary: 'Create a warehouse', body: warehouseCreateSchema });
  doc('put', `${base}/warehouses/{id}`, { tags: [tag, 'Inventory'], summary: 'Update a warehouse', params: idParam, body: warehouseUpdateSchema, status: 200 });

  return router;
}

import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, noContent, ok, paginated } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { validate } from '../../middleware/validate';
import { authenticate, requireUserType } from '../../middleware/auth';
import { requirePermission, retailerScope } from '../../middleware/rbac';
import { uploader } from '../../middleware/upload';
import { toSignedUrl } from '../../lib/signed-url';
import { auditFromRequest } from '../../lib/audit';
import { AUDIT_MODULES } from '../../config/constants';
import { PERMISSIONS } from '../../config/permissions';
import { exportQuery, idParam } from '../../common/query.validation';
import { listPriceHistory } from '../../common/price-history';
import { doc } from '../../lib/openapi';
import { sendExport } from '../../utils/export';
import { csvUpload, parseCsvBuffer } from '../../utils/csv-import';
import { createInventoryRouter } from '../inventory/inventory.routes';
import { retailerPurchaseRouter } from '../purchases/purchase.routes';
import { retailerOrderRouter } from '../orders/order.routes';
import { retailerDisputeRouter } from '../disputes/dispute.routes';
import { createFinanceRouter } from '../finance/finance.routes';
import { createReportRouter } from '../reports/report.routes';
import { createStaffRouter } from '../staff/staff.routes';
import { retailerPosRouter } from '../pos/pos.routes';
import { createTemplateRouter } from '../notifications/template.routes';
import type { StockOwner } from '../inventory/inventory.service';
import { documentUploadSchema } from '../vendors/vendor.validation';
import * as service from './retailer.service';
import * as pickup from './pickup.service';
import {
  businessHoursSchema,
  holidayCreateSchema,
  pickupConfigSchema,
  retailerProductCreateSchema,
  retailerProductListQuery,
  retailerProductUpdateSchema,
  retailerProfileSchema,
  slotStatusSchema,
  storeImageSchema,
  temporaryClosureSchema,
  vendorBrowseQuery,
  vendorProductBrowseQuery,
} from './retailer.validation';

const router = Router();
const documentUpload = uploader('shop-documents');
const imageUpload = uploader('store-images');

router.use(authenticate, requireUserType('RETAILER'));

const owner = (req: Request): StockOwner => ({ ownerType: 'RETAILER', retailerId: retailerScope(req) });

// ---------------------------------------------------------------------------
// Store profile
// ---------------------------------------------------------------------------

router.get(
  '/profile',
  asyncHandler(async (req, res) => ok(res, await service.getProfile(retailerScope(req)))),
);

router.put(
  '/profile',
  validate({ body: retailerProfileSchema }),
  asyncHandler(async (req, res) => {
    const retailerId = retailerScope(req);
    const before = await service.getProfile(retailerId);
    const retailer = await service.updateProfile(retailerId, req.body);
    await auditFromRequest(req, {
      action: 'retailer.profile_update',
      module: AUDIT_MODULES.RETAILER,
      recordId: retailerId,
      oldValue: before,
      newValue: retailer,
    });
    return ok(res, retailer, 'Store profile updated');
  }),
);

router.patch(
  '/profile/closure',
  validate({ body: temporaryClosureSchema }),
  asyncHandler(async (req, res) => {
    const retailer = await service.setTemporaryClosure(
      retailerScope(req),
      req.body.isTemporarilyClosed,
      req.body.closureReason,
    );
    await auditFromRequest(req, {
      action: 'retailer.closure',
      module: AUDIT_MODULES.RETAILER,
      recordId: retailer.id,
      newValue: req.body,
    });
    return ok(res, retailer, req.body.isTemporarilyClosed ? 'Store marked as closed' : 'Store reopened');
  }),
);

router.post(
  '/documents',
  documentUpload.single('file'),
  validate({ body: documentUploadSchema }),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('A document file is required');
    const document = await service.addDocument(retailerScope(req), req.file, req.body);
    return created(res, { ...document, fileUrl: toSignedUrl(document.fileUrl) ?? document.fileUrl }, 'Document uploaded');
  }),
);

router.delete(
  '/documents/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await service.deleteDocument(retailerScope(req), req.params.id);
    return noContent(res, 'Document removed');
  }),
);

router.post(
  '/images',
  imageUpload.single('file'),
  validate({ body: storeImageSchema }),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('An image file is required');
    const image = await service.addImage(retailerScope(req), req.file, req.body);
    return created(res, image, 'Store image uploaded');
  }),
);

router.delete(
  '/images/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await service.deleteImage(retailerScope(req), req.params.id);
    return noContent(res, 'Image removed');
  }),
);

// ---------------------------------------------------------------------------
// Business hours, holidays, pickup slots
// ---------------------------------------------------------------------------

router.get(
  '/business-hours',
  asyncHandler(async (req, res) =>
    ok(
      res,
      await prisma.storeBusinessHour.findMany({
        where: { retailerId: retailerScope(req) },
        orderBy: { dayOfWeek: 'asc' },
      }),
    ),
  ),
);

router.put(
  '/business-hours',
  requirePermission(PERMISSIONS.STORE_MANAGE),
  validate({ body: businessHoursSchema }),
  asyncHandler(async (req, res) => {
    const hours = await service.setBusinessHours(retailerScope(req), req.body.hours);
    await auditFromRequest(req, {
      action: 'retailer.business_hours',
      module: AUDIT_MODULES.RETAILER,
      recordId: retailerScope(req),
      newValue: req.body.hours,
    });
    return ok(res, hours, 'Business hours updated');
  }),
);

router.get(
  '/holidays',
  asyncHandler(async (req, res) => ok(res, await service.listHolidays(retailerScope(req)))),
);

router.post(
  '/holidays',
  requirePermission(PERMISSIONS.STORE_MANAGE),
  validate({ body: holidayCreateSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.addHoliday(retailerScope(req), req.body);
    return created(
      res,
      result,
      result.bookedSlotsNeedingAttention > 0
        ? `Holiday saved. ${result.bookedSlotsNeedingAttention} slot(s) already have bookings — contact those customers.`
        : 'Holiday saved',
    );
  }),
);

router.delete(
  '/holidays/:id',
  requirePermission(PERMISSIONS.STORE_MANAGE),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await service.deleteHoliday(retailerScope(req), req.params.id);
    return noContent(res, 'Holiday removed');
  }),
);

router.get(
  '/pickup/config',
  asyncHandler(async (req, res) =>
    ok(res, await prisma.pickupSlotConfig.findUnique({ where: { retailerId: retailerScope(req) } })),
  ),
);

router.put(
  '/pickup/config',
  requirePermission(PERMISSIONS.PICKUP_MANAGE),
  validate({ body: pickupConfigSchema }),
  asyncHandler(async (req, res) => {
    const config = await service.updatePickupConfig(retailerScope(req), req.body);
    await auditFromRequest(req, {
      action: 'retailer.pickup_config',
      module: AUDIT_MODULES.RETAILER,
      recordId: config.id,
      newValue: req.body,
    });
    return ok(res, config, 'Pickup configuration updated');
  }),
);

router.get(
  '/pickup/slots',
  validate({ query: z.object({ days: z.coerce.number().int().min(1).max(30).default(7) }) }),
  asyncHandler(async (req, res) =>
    ok(res, await pickup.slotCalendar(retailerScope(req), Number(req.query.days ?? 7))),
  ),
);

router.patch(
  '/pickup/slots/:id',
  requirePermission(PERMISSIONS.PICKUP_MANAGE),
  validate({ params: idParam, body: slotStatusSchema }),
  asyncHandler(async (req, res) => {
    const slot = await prisma.pickupSlot.findFirst({
      where: { id: req.params.id, retailerId: retailerScope(req) },
    });
    if (!slot) throw ApiError.notFound('Pickup slot not found');
    if (req.body.status === 'DISABLED' && slot.bookedCount > 0) {
      throw ApiError.badRequest(
        `This slot has ${slot.bookedCount} booked order(s) — cancel or reschedule them before disabling it`,
      );
    }

    const updated = await prisma.pickupSlot.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
    });
    return ok(res, updated, 'Pickup slot updated');
  }),
);

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

router.get(
  '/products',
  requirePermission(PERMISSIONS.CATALOG_VIEW),
  validate({ query: retailerProductListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listCatalog(retailerScope(req), req.query as Record<string, unknown>);
    return paginated(res, items, meta);
  }),
);

router.post(
  '/products',
  requirePermission(PERMISSIONS.CATALOG_MANAGE),
  validate({ body: retailerProductCreateSchema }),
  asyncHandler(async (req, res) => {
    const entry = await service.addCatalogProduct(retailerScope(req), req.body, req.user!.id);
    await auditFromRequest(req, {
      action: 'catalog.add',
      module: AUDIT_MODULES.CATALOG,
      recordId: entry.id,
      newValue: entry,
    });
    return created(res, entry, 'Product added to your store');
  }),
);

router.get(
  '/products/export',
  requirePermission(PERMISSIONS.CATALOG_VIEW),
  validate({ query: exportQuery }),
  asyncHandler(async (req, res) => {
    const rows = await service.listCatalogForExport(retailerScope(req));
    const handled = await sendExport(res, (req.query.format as 'json' | 'csv' | 'excel' | 'pdf') ?? 'csv', {
      filename: 'my-catalogue',
      title: 'My catalogue',
      columns: service.RETAILER_CATALOG_EXPORT_COLUMNS,
      rows,
    });
    if (!handled) return ok(res, rows);
  }),
);

router.post(
  '/products/import',
  requirePermission(PERMISSIONS.CATALOG_MANAGE),
  csvUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Attach a .csv file');
    const rows = await parseCsvBuffer(req.file.buffer);
    if (rows.length === 0) throw ApiError.badRequest('The file has no data rows');

    const result = await service.importCatalog(retailerScope(req), rows, req.user!.id);
    await auditFromRequest(req, {
      action: 'catalog.import',
      module: AUDIT_MODULES.CATALOG,
      newValue: { added: result.added, updated: result.updated, errors: result.errors.length },
    });
    return ok(res, result, `Imported ${result.added + result.updated} of ${rows.length} rows`);
  }),
);

router.put(
  '/products/:id',
  requirePermission(PERMISSIONS.CATALOG_MANAGE),
  validate({ params: idParam, body: retailerProductUpdateSchema }),
  asyncHandler(async (req, res) => {
    const entry = await service.updateCatalogProduct(
      retailerScope(req),
      req.params.id,
      req.body,
      req.user!.id,
    );
    await auditFromRequest(req, {
      action: 'catalog.update',
      module: AUDIT_MODULES.CATALOG,
      recordId: entry.id,
      newValue: entry,
    });
    return ok(res, entry, 'Product updated');
  }),
);

router.delete(
  '/products/:id',
  requirePermission(PERMISSIONS.CATALOG_MANAGE),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await service.removeCatalogProduct(retailerScope(req), req.params.id);
    return noContent(res, 'Product removed from your store');
  }),
);

router.get(
  '/products/:id/price-history',
  requirePermission(PERMISSIONS.CATALOG_VIEW),
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    ok(res, await listPriceHistory('RETAILER', retailerScope(req), req.params.id)),
  ),
);

// ---------------------------------------------------------------------------
// Wholesale sourcing
// ---------------------------------------------------------------------------

router.get(
  '/vendors',
  requirePermission(PERMISSIONS.PURCHASE_VIEW),
  validate({ query: vendorBrowseQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listVendors(req.query as Record<string, unknown>);
    return paginated(res, items, meta);
  }),
);

router.get(
  '/vendor-products',
  requirePermission(PERMISSIONS.PURCHASE_VIEW),
  validate({ query: vendorProductBrowseQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listVendorProducts(req.query as Record<string, unknown>);
    return paginated(res, items, meta);
  }),
);

// ---------------------------------------------------------------------------
// Inventory & dashboard
// ---------------------------------------------------------------------------

router.use('/inventory', createInventoryRouter(owner, 'Retailer'));
router.use('/purchases', retailerPurchaseRouter);
router.use('/orders', retailerOrderRouter);
router.use('/disputes', retailerDisputeRouter);
router.use('/finance', createFinanceRouter((req) => ({ ownerType: 'RETAILER', retailerId: retailerScope(req) }), 'Retailer'));
router.use('/reports', createReportRouter((req) => ({ ownerType: 'RETAILER', retailerId: retailerScope(req) }), 'Retailer'));
router.use('/staff', createStaffRouter(owner, 'RETAILER', 'Retailer'));
router.use('/pos', retailerPosRouter);
router.use('/notification-templates', createTemplateRouter('RETAILER', '/retailer', (req) => retailerScope(req)));

router.get(
  '/dashboard',
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  validate({ query: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }) }),
  asyncHandler(async (req, res) =>
    ok(res, await service.dashboard(retailerScope(req), Number(req.query.days ?? 30))),
  ),
);

doc('get', '/retailer/profile', { tags: ['Retailer'], summary: 'Get the signed-in store profile' });
doc('put', '/retailer/profile', { tags: ['Retailer'], summary: 'Update store details and location', body: retailerProfileSchema, status: 200 });
doc('patch', '/retailer/profile/closure', { tags: ['Retailer'], summary: 'Temporarily close or reopen the store', body: temporaryClosureSchema, status: 200 });
doc('post', '/retailer/documents', { tags: ['Retailer'], summary: 'Upload a licence / KYC document', body: documentUploadSchema, multipart: true });
doc('delete', '/retailer/documents/{id}', { tags: ['Retailer'], summary: 'Remove a pending document', params: idParam });
doc('post', '/retailer/images', { tags: ['Retailer'], summary: 'Upload a store photo', body: storeImageSchema, multipart: true });
doc('delete', '/retailer/images/{id}', { tags: ['Retailer'], summary: 'Delete a store photo', params: idParam });
doc('get', '/retailer/business-hours', { tags: ['Retailer'], summary: 'Get weekly business hours' });
doc('put', '/retailer/business-hours', { tags: ['Retailer'], summary: 'Set weekly business hours', body: businessHoursSchema, status: 200 });
doc('get', '/retailer/holidays', { tags: ['Retailer'], summary: 'List store holidays' });
doc('post', '/retailer/holidays', { tags: ['Retailer'], summary: 'Add a holiday or special hours', body: holidayCreateSchema });
doc('delete', '/retailer/holidays/{id}', { tags: ['Retailer'], summary: 'Remove a holiday', params: idParam });
doc('get', '/retailer/pickup/config', { tags: ['Retailer'], summary: 'Get pickup slot configuration' });
doc('put', '/retailer/pickup/config', { tags: ['Retailer'], summary: 'Configure slot duration, capacity and buffer', body: pickupConfigSchema, status: 200 });
doc('get', '/retailer/pickup/slots', { tags: ['Retailer'], summary: 'Pickup slot calendar' });
doc('patch', '/retailer/pickup/slots/{id}', { tags: ['Retailer'], summary: 'Enable or disable a pickup slot', params: idParam, body: slotStatusSchema, status: 200 });
doc('get', '/retailer/products', { tags: ['Retailer'], summary: 'List the store catalogue', query: retailerProductListQuery, paginated: true });
doc('post', '/retailer/products', { tags: ['Retailer'], summary: 'Add a master product to the store', body: retailerProductCreateSchema });
doc('get', '/retailer/products/export', { tags: ['Retailer'], summary: 'Export the catalogue' });
doc('post', '/retailer/products/import', { tags: ['Retailer'], summary: 'Bulk import/update the catalogue from CSV' });
doc('put', '/retailer/products/{id}', { tags: ['Retailer'], summary: 'Update store pricing and status', params: idParam, body: retailerProductUpdateSchema, status: 200 });
doc('delete', '/retailer/products/{id}', { tags: ['Retailer'], summary: 'Remove a product from the store', params: idParam });
doc('get', '/retailer/products/{id}/price-history', { tags: ['Retailer'], summary: 'Price change history', params: idParam });
doc('get', '/retailer/vendors', { tags: ['Retailer'], summary: 'Browse approved wholesalers', query: vendorBrowseQuery, paginated: true });
doc('get', '/retailer/vendor-products', { tags: ['Retailer'], summary: 'Browse wholesale products with live availability', query: vendorProductBrowseQuery, paginated: true });
doc('get', '/retailer/dashboard', { tags: ['Retailer'], summary: 'Store dashboard cards and charts' });

export default router;

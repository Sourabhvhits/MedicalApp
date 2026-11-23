import { Router, type Request } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, noContent, ok, paginated } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { validate } from '../../middleware/validate';
import { authenticate, requireUserType } from '../../middleware/auth';
import { requirePermission, vendorScope } from '../../middleware/rbac';
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
import { vendorOrderRouter } from '../purchases/purchase.routes';
import { createFinanceRouter } from '../finance/finance.routes';
import { createReportRouter } from '../reports/report.routes';
import { createStaffRouter } from '../staff/staff.routes';
import { createTemplateRouter } from '../notifications/template.routes';
import type { StockOwner } from '../inventory/inventory.service';
import * as service from './vendor.service';
import {
  bulkPriceUpdateSchema,
  documentUploadSchema,
  retailerTermsSchema,
  vendorProductCreateSchema,
  vendorProductListQuery,
  vendorProductUpdateSchema,
  vendorProfileSchema,
} from './vendor.validation';

const router = Router();
const upload = uploader('vendor-documents');

router.use(authenticate, requireUserType('VENDOR'));

const owner = (req: Request): StockOwner => ({ ownerType: 'VENDOR', vendorId: vendorScope(req) });

// ---------------------------------------------------------------------------
// Profile & KYC
// ---------------------------------------------------------------------------

router.get(
  '/profile',
  asyncHandler(async (req, res) => ok(res, await service.getProfile(vendorScope(req)))),
);

router.put(
  '/profile',
  validate({ body: vendorProfileSchema }),
  asyncHandler(async (req, res) => {
    const vendorId = vendorScope(req);
    const before = await service.getProfile(vendorId);
    const vendor = await service.updateProfile(vendorId, req.body);
    await auditFromRequest(req, {
      action: 'vendor.profile_update',
      module: AUDIT_MODULES.VENDOR,
      recordId: vendorId,
      oldValue: before,
      newValue: vendor,
    });
    return ok(res, vendor, 'Profile updated');
  }),
);

router.post(
  '/documents',
  upload.single('file'),
  validate({ body: documentUploadSchema }),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('A document file is required');
    const document = await service.addDocument(vendorScope(req), req.file, req.body);
    await auditFromRequest(req, {
      action: 'vendor.document_upload',
      module: AUDIT_MODULES.VENDOR,
      recordId: document.id,
      newValue: { type: document.type, fileName: document.fileName },
    });
    return created(res, { ...document, fileUrl: toSignedUrl(document.fileUrl) ?? document.fileUrl }, 'Document uploaded');
  }),
);

router.delete(
  '/documents/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await service.deleteDocument(vendorScope(req), req.params.id);
    return noContent(res, 'Document removed');
  }),
);

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

router.get(
  '/products',
  requirePermission(PERMISSIONS.CATALOG_VIEW),
  validate({ query: vendorProductListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listCatalog(vendorScope(req), req.query as Record<string, unknown>);
    return paginated(res, items, meta);
  }),
);

router.post(
  '/products',
  requirePermission(PERMISSIONS.CATALOG_MANAGE),
  validate({ body: vendorProductCreateSchema }),
  asyncHandler(async (req, res) => {
    const entry = await service.addCatalogProduct(vendorScope(req), req.body, req.user!.id);
    await auditFromRequest(req, {
      action: 'catalog.add',
      module: AUDIT_MODULES.CATALOG,
      recordId: entry.id,
      newValue: entry,
    });
    return created(res, entry, 'Product added to your catalogue');
  }),
);

router.get(
  '/products/export',
  requirePermission(PERMISSIONS.CATALOG_VIEW),
  validate({ query: exportQuery }),
  asyncHandler(async (req, res) => {
    const rows = await service.listCatalogForExport(vendorScope(req));
    const handled = await sendExport(res, (req.query.format as 'json' | 'csv' | 'excel' | 'pdf') ?? 'csv', {
      filename: 'my-catalogue',
      title: 'My catalogue',
      columns: service.VENDOR_CATALOG_EXPORT_COLUMNS,
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

    const result = await service.importCatalog(vendorScope(req), rows, req.user!.id);
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
  validate({ params: idParam, body: vendorProductUpdateSchema }),
  asyncHandler(async (req, res) => {
    const entry = await service.updateCatalogProduct(
      vendorScope(req),
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
    return ok(res, entry, 'Catalogue entry updated');
  }),
);

router.patch(
  '/products/bulk-price',
  requirePermission(PERMISSIONS.CATALOG_MANAGE),
  validate({ body: bulkPriceUpdateSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.bulkUpdatePrices(vendorScope(req), req.body.items, req.user!.id);
    await auditFromRequest(req, {
      action: 'catalog.bulk_price',
      module: AUDIT_MODULES.CATALOG,
      newValue: result,
    });
    return ok(res, result, 'Prices updated');
  }),
);

router.delete(
  '/products/:id',
  requirePermission(PERMISSIONS.CATALOG_MANAGE),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await service.removeCatalogProduct(vendorScope(req), req.params.id);
    await auditFromRequest(req, {
      action: 'catalog.remove',
      module: AUDIT_MODULES.CATALOG,
      recordId: req.params.id,
    });
    return noContent(res, 'Product removed from your catalogue');
  }),
);

router.get(
  '/products/:id/price-history',
  requirePermission(PERMISSIONS.CATALOG_VIEW),
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    ok(res, await listPriceHistory('VENDOR', vendorScope(req), req.params.id)),
  ),
);

// ---------------------------------------------------------------------------
// Inventory & dashboard
// ---------------------------------------------------------------------------

router.use('/inventory', createInventoryRouter(owner, 'Vendor'));
router.use('/orders', vendorOrderRouter);
router.use('/finance', createFinanceRouter((req) => ({ ownerType: 'VENDOR', vendorId: vendorScope(req) }), 'Vendor'));
router.use('/reports', createReportRouter((req) => ({ ownerType: 'VENDOR', vendorId: vendorScope(req) }), 'Vendor'));
router.use('/staff', createStaffRouter(owner, 'VENDOR', 'Vendor'));
router.use('/notification-templates', createTemplateRouter('VENDOR', '/vendor', (req) => vendorScope(req)));

// ---------------------------------------------------------------------------
// Per-retailer credit limit & payment terms
// ---------------------------------------------------------------------------

router.get(
  '/retailers/terms',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  asyncHandler(async (req, res) => ok(res, await service.listRetailerTerms(vendorScope(req)))),
);

router.put(
  '/retailers/:retailerId/terms',
  requirePermission(PERMISSIONS.FINANCE_MANAGE),
  validate({ params: z.object({ retailerId: z.string().uuid() }), body: retailerTermsSchema }),
  asyncHandler(async (req, res) => {
    const terms = await service.setRetailerTerms(vendorScope(req), req.params.retailerId, req.body);
    await auditFromRequest(req, {
      action: 'vendor.retailer_terms',
      module: AUDIT_MODULES.FINANCE,
      recordId: terms.id,
      newValue: { retailerId: req.params.retailerId, ...req.body },
    });
    return ok(res, terms, 'Terms updated');
  }),
);

doc('get', '/vendor/retailers/terms', { tags: ['Vendor'], summary: 'Credit limit & payment terms per retailer you supply' });
doc('put', '/vendor/retailers/{retailerId}/terms', { tags: ['Vendor'], summary: 'Set credit limit & payment terms for a retailer', params: z.object({ retailerId: z.string().uuid() }), body: retailerTermsSchema, status: 200 });

router.get(
  '/dashboard',
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  validate({ query: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }) }),
  asyncHandler(async (req, res) =>
    ok(res, await service.dashboard(vendorScope(req), Number(req.query.days ?? 30))),
  ),
);

doc('get', '/vendor/profile', { tags: ['Vendor'], summary: 'Get the signed-in vendor profile' });
doc('put', '/vendor/profile', { tags: ['Vendor'], summary: 'Update company and business details', body: vendorProfileSchema, status: 200 });
doc('post', '/vendor/documents', { tags: ['Vendor'], summary: 'Upload a KYC / licence document', body: documentUploadSchema, multipart: true });
doc('delete', '/vendor/documents/{id}', { tags: ['Vendor'], summary: 'Remove a pending document', params: idParam });
doc('get', '/vendor/products', { tags: ['Vendor'], summary: 'List the vendor catalogue', query: vendorProductListQuery, paginated: true });
doc('post', '/vendor/products', { tags: ['Vendor'], summary: 'Add a master product to the catalogue', body: vendorProductCreateSchema });
doc('get', '/vendor/products/export', { tags: ['Vendor'], summary: 'Export the catalogue' });
doc('post', '/vendor/products/import', { tags: ['Vendor'], summary: 'Bulk import/update the catalogue from CSV' });
doc('put', '/vendor/products/{id}', { tags: ['Vendor'], summary: 'Update catalogue pricing and status', params: idParam, body: vendorProductUpdateSchema, status: 200 });
doc('patch', '/vendor/products/bulk-price', { tags: ['Vendor'], summary: 'Bulk update catalogue prices', body: bulkPriceUpdateSchema, status: 200 });
doc('delete', '/vendor/products/{id}', { tags: ['Vendor'], summary: 'Remove a catalogue entry', params: idParam });
doc('get', '/vendor/products/{id}/price-history', { tags: ['Vendor'], summary: 'Price change history for a product', params: idParam });
doc('get', '/vendor/dashboard', { tags: ['Vendor'], summary: 'Vendor dashboard cards and charts' });

export default router;

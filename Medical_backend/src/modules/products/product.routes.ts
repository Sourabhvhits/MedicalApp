import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, noContent, ok, paginated } from '../../utils/response';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { auditFromRequest } from '../../lib/audit';
import { AUDIT_MODULES } from '../../config/constants';
import { PERMISSIONS } from '../../config/permissions';
import { idParam, exportQuery } from '../../common/query.validation';
import { doc } from '../../lib/openapi';
import { ApiError } from '../../utils/ApiError';
import { sendExport } from '../../utils/export';
import { csvUpload, parseCsvBuffer } from '../../utils/csv-import';
import * as service from './product.service';
import {
  productCreateSchema,
  productListQuery,
  productRecallSchema,
  productStatusSchema,
  productUpdateSchema,
} from './product.validation';

const router = Router();

router.use(authenticate);

/**
 * The product master is readable by every authenticated business role — vendors
 * and retailers pick from it — but only writable with admin permissions.
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.PRODUCT_VIEW),
  validate({ query: productListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listProducts(req.query as never);
    return paginated(res, items, meta);
  }),
);

const productExportQuery = productListQuery.merge(exportQuery);

// Registered before /:id so "export" is never parsed as a product id.
router.get(
  '/export',
  requirePermission(PERMISSIONS.PRODUCT_VIEW),
  validate({ query: productExportQuery }),
  asyncHandler(async (req, res) => {
    const rows = await service.listProductsForExport(req.query as never);
    const handled = await sendExport(res, (req.query.format as 'json' | 'csv' | 'excel' | 'pdf') ?? 'csv', {
      filename: 'master-products',
      title: 'Master product catalogue',
      columns: service.PRODUCT_EXPORT_COLUMNS,
      rows,
    });
    if (!handled) return ok(res, rows);
  }),
);

router.post(
  '/import',
  requirePermission(PERMISSIONS.PRODUCT_CREATE),
  csvUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Attach a .csv file');
    const rows = await parseCsvBuffer(req.file.buffer);
    if (rows.length === 0) throw ApiError.badRequest('The file has no data rows');

    const result = await service.importProducts(rows, req.user!.id);
    await auditFromRequest(req, {
      action: 'product.import',
      module: AUDIT_MODULES.PRODUCT,
      newValue: { added: result.added, updated: result.updated, errors: result.errors.length },
    });
    return ok(res, result, `Imported ${result.added + result.updated} of ${rows.length} rows`);
  }),
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.PRODUCT_VIEW),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await service.getProduct(req.params.id))),
);

router.post(
  '/',
  requirePermission(PERMISSIONS.PRODUCT_CREATE),
  validate({ body: productCreateSchema }),
  asyncHandler(async (req, res) => {
    const product = await service.createProduct(req.body, req.user!.id);
    await auditFromRequest(req, {
      action: 'product.create',
      module: AUDIT_MODULES.PRODUCT,
      recordId: product.id,
      newValue: product,
    });
    return created(res, product, 'Product created');
  }),
);

router.put(
  '/:id',
  requirePermission(PERMISSIONS.PRODUCT_EDIT),
  validate({ params: idParam, body: productUpdateSchema }),
  asyncHandler(async (req, res) => {
    const before = await service.getProduct(req.params.id);
    const product = await service.updateProduct(req.params.id, req.body);
    await auditFromRequest(req, {
      action: 'product.update',
      module: AUDIT_MODULES.PRODUCT,
      recordId: product.id,
      oldValue: before,
      newValue: product,
    });
    return ok(res, product, 'Product updated');
  }),
);

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.PRODUCT_EDIT),
  validate({ params: idParam, body: productStatusSchema }),
  asyncHandler(async (req, res) => {
    const before = await service.getProduct(req.params.id);
    const product = await service.setProductStatus(req.params.id, req.body.status);
    await auditFromRequest(req, {
      action: 'product.status',
      module: AUDIT_MODULES.PRODUCT,
      recordId: product.id,
      oldValue: { status: before.status },
      newValue: { status: product.status, reason: req.body.reason },
    });
    return ok(res, product, 'Product status updated');
  }),
);

router.patch(
  '/:id/recall',
  requirePermission(PERMISSIONS.PRODUCT_EDIT),
  validate({ params: idParam, body: productRecallSchema }),
  asyncHandler(async (req, res) => {
    const product = await service.setProductRecall(
      req.params.id,
      req.body.isRecalled,
      req.body.recallReason,
    );
    await auditFromRequest(req, {
      action: 'product.recall',
      module: AUDIT_MODULES.PRODUCT,
      recordId: product.id,
      newValue: { isRecalled: req.body.isRecalled, reason: req.body.recallReason },
    });
    return ok(res, product, req.body.isRecalled ? 'Product recalled' : 'Recall lifted');
  }),
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.PRODUCT_DELETE),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const before = await service.getProduct(req.params.id);
    await service.deleteProduct(req.params.id);
    await auditFromRequest(req, {
      action: 'product.delete',
      module: AUDIT_MODULES.PRODUCT,
      recordId: req.params.id,
      oldValue: before,
    });
    return noContent(res, 'Product deleted');
  }),
);

doc('get', '/products', { tags: ['Admin Masters'], summary: 'List master products', query: productListQuery, paginated: true });
doc('get', '/products/export', { tags: ['Admin Masters'], summary: 'Export the master catalogue', query: productExportQuery });
doc('post', '/products/import', { tags: ['Admin Masters'], summary: 'Bulk import/update the master catalogue from CSV' });
doc('get', '/products/{id}', { tags: ['Admin Masters'], summary: 'Get master product', params: idParam });
doc('post', '/products', { tags: ['Admin Masters'], summary: 'Create master product', body: productCreateSchema });
doc('put', '/products/{id}', { tags: ['Admin Masters'], summary: 'Update master product', params: idParam, body: productUpdateSchema });
doc('patch', '/products/{id}/status', { tags: ['Admin Masters'], summary: 'Activate / deactivate / block a product', params: idParam, body: productStatusSchema });
doc('patch', '/products/{id}/recall', { tags: ['Admin Masters'], summary: 'Recall or un-recall a product', params: idParam, body: productRecallSchema });
doc('delete', '/products/{id}', { tags: ['Admin Masters'], summary: 'Delete master product', params: idParam });

export default router;

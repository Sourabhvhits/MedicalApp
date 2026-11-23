import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../config/permissions';
import { dateRangeQuery, exportQuery } from '../../common/query.validation';
import { sendExport, type ExportColumn } from '../../utils/export';
import { dayjs } from '../../utils/time';
import { doc } from '../../lib/openapi';
import * as service from './report.service';
import type { ReportScope } from './report.service';

const reportQuery = dateRangeQuery.merge(exportQuery).extend({
  retailerId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(10_000).optional(),
  days: z.coerce.number().int().min(0).max(365).optional(),
});

type ReportResult = { rows: Record<string, unknown>[]; totals: Record<string, unknown> };

/**
 * Runs a report and returns JSON, or streams CSV / Excel / PDF with the same
 * filtered rows — so an export always matches what the screen showed.
 */
async function respond(
  req: Request,
  res: Response,
  config: {
    title: string;
    filename: string;
    columns: readonly ExportColumn[];
    result: ReportResult;
  },
) {
  const format = (req.query.format as 'json' | 'csv' | 'excel' | 'pdf') ?? 'json';

  if (format === 'json') {
    return ok(res, { rows: config.result.rows, totals: config.result.totals });
  }

  const handled = await sendExport(res, format, {
    filename: `${config.filename}-${dayjs().format('YYYYMMDD-HHmm')}`,
    title: config.title,
    subtitle: service.describeFilters(req.query as never),
    columns: config.columns as ExportColumn[],
    rows: config.result.rows,
    totals: config.result.totals,
  });

  if (!handled) return ok(res, config.result);
  return undefined;
}

/** Mounted by admin, vendor and retailer with their own data scope. */
export function createReportRouter(resolveScope: (req: Request) => ReportScope, tag: string): Router {
  const router = Router();
  router.use(requirePermission(PERMISSIONS.REPORT_VIEW));

  router.get(
    '/sales',
    validate({ query: reportQuery }),
    asyncHandler(async (req, res) =>
      respond(req, res, {
        title: 'Sales Report',
        filename: 'sales-report',
        columns: service.REPORT_COLUMNS.sales,
        result: await service.salesReport(resolveScope(req), req.query as never),
      }),
    ),
  );

  router.get(
    '/sales-by-product',
    validate({ query: reportQuery }),
    asyncHandler(async (req, res) =>
      respond(req, res, {
        title: 'Product-wise Sales Report',
        filename: 'sales-by-product',
        columns: service.REPORT_COLUMNS.salesByProduct,
        result: await service.salesByProduct(resolveScope(req), req.query as never),
      }),
    ),
  );

  router.get(
    '/purchases',
    validate({ query: reportQuery }),
    asyncHandler(async (req, res) =>
      respond(req, res, {
        title: 'Purchase Report',
        filename: 'purchase-report',
        columns: service.REPORT_COLUMNS.purchase,
        result: await service.purchaseReport(resolveScope(req), req.query as never),
      }),
    ),
  );

  router.get(
    '/stock',
    validate({ query: reportQuery }),
    asyncHandler(async (req, res) =>
      respond(req, res, {
        title: 'Batch-wise Stock Report',
        filename: 'stock-report',
        columns: service.REPORT_COLUMNS.stock,
        result: await service.stockReport(resolveScope(req), req.query as never),
      }),
    ),
  );

  router.get(
    '/stock-movement',
    validate({ query: reportQuery }),
    asyncHandler(async (req, res) =>
      respond(req, res, {
        title: 'Stock Movement Report',
        filename: 'stock-movement',
        columns: service.REPORT_COLUMNS.stockMovement,
        result: await service.stockMovementReport(resolveScope(req), req.query as never),
      }),
    ),
  );

  router.get(
    '/low-stock',
    validate({ query: reportQuery }),
    asyncHandler(async (req, res) =>
      respond(req, res, {
        title: 'Low Stock Report',
        filename: 'low-stock',
        columns: service.REPORT_COLUMNS.lowStock,
        result: await service.lowStockReport(resolveScope(req)),
      }),
    ),
  );

  router.get(
    '/expiry',
    validate({ query: reportQuery }),
    asyncHandler(async (req, res) =>
      respond(req, res, {
        title:
          Number(req.query.days ?? 90) === 0
            ? 'Expired Stock Report'
            : `Expiry Report — next ${req.query.days ?? 90} days`,
        filename: 'expiry-report',
        columns: service.REPORT_COLUMNS.expiry,
        result: await service.expiryReport(resolveScope(req), req.query as never),
      }),
    ),
  );

  router.get(
    '/expiry-summary',
    asyncHandler(async (req, res) => ok(res, await service.expirySummaryReport(resolveScope(req)))),
  );

  router.get(
    '/orders',
    validate({ query: reportQuery }),
    asyncHandler(async (req, res) => ok(res, await service.orderReport(resolveScope(req), req.query as never))),
  );

  const base =
    tag === 'Vendor' ? '/vendor/reports' : tag === 'Retailer' ? '/retailer/reports' : '/admin/reports';

  doc('get', `${base}/sales`, { tags: [tag, 'Reports'], summary: 'Sales report (json/csv/excel/pdf)', query: reportQuery });
  doc('get', `${base}/sales-by-product`, { tags: [tag, 'Reports'], summary: 'Product-wise sales', query: reportQuery });
  doc('get', `${base}/purchases`, { tags: [tag, 'Reports'], summary: 'Purchase report', query: reportQuery });
  doc('get', `${base}/stock`, { tags: [tag, 'Reports'], summary: 'Batch-wise stock and valuation', query: reportQuery });
  doc('get', `${base}/stock-movement`, { tags: [tag, 'Reports'], summary: 'Stock movement ledger', query: reportQuery });
  doc('get', `${base}/low-stock`, { tags: [tag, 'Reports'], summary: 'Low and out-of-stock products', query: reportQuery });
  doc('get', `${base}/expiry`, { tags: [tag, 'Reports'], summary: 'Expiry report (days=0 for expired)', query: reportQuery });
  doc('get', `${base}/expiry-summary`, { tags: [tag, 'Reports'], summary: 'Expiry bucket counts and value at risk' });
  doc('get', `${base}/orders`, { tags: [tag, 'Reports'], summary: 'Order analytics by status, store and day', query: reportQuery });

  return router;
}

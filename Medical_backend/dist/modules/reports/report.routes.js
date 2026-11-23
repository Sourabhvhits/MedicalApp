"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReportRouter = createReportRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const validate_1 = require("../../middleware/validate");
const rbac_1 = require("../../middleware/rbac");
const permissions_1 = require("../../config/permissions");
const query_validation_1 = require("../../common/query.validation");
const export_1 = require("../../utils/export");
const time_1 = require("../../utils/time");
const openapi_1 = require("../../lib/openapi");
const service = __importStar(require("./report.service"));
const reportQuery = query_validation_1.dateRangeQuery.merge(query_validation_1.exportQuery).extend({
    retailerId: zod_1.z.string().uuid().optional(),
    vendorId: zod_1.z.string().uuid().optional(),
    productId: zod_1.z.string().uuid().optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    customerId: zod_1.z.string().uuid().optional(),
    status: zod_1.z.string().trim().max(40).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(10_000).optional(),
    days: zod_1.z.coerce.number().int().min(0).max(365).optional(),
});
/**
 * Runs a report and returns JSON, or streams CSV / Excel / PDF with the same
 * filtered rows — so an export always matches what the screen showed.
 */
async function respond(req, res, config) {
    const format = req.query.format ?? 'json';
    if (format === 'json') {
        return (0, response_1.ok)(res, { rows: config.result.rows, totals: config.result.totals });
    }
    const handled = await (0, export_1.sendExport)(res, format, {
        filename: `${config.filename}-${(0, time_1.dayjs)().format('YYYYMMDD-HHmm')}`,
        title: config.title,
        subtitle: service.describeFilters(req.query),
        columns: config.columns,
        rows: config.result.rows,
        totals: config.result.totals,
    });
    if (!handled)
        return (0, response_1.ok)(res, config.result);
    return undefined;
}
/** Mounted by admin, vendor and retailer with their own data scope. */
function createReportRouter(resolveScope, tag) {
    const router = (0, express_1.Router)();
    router.use((0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.REPORT_VIEW));
    router.get('/sales', (0, validate_1.validate)({ query: reportQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => respond(req, res, {
        title: 'Sales Report',
        filename: 'sales-report',
        columns: service.REPORT_COLUMNS.sales,
        result: await service.salesReport(resolveScope(req), req.query),
    })));
    router.get('/sales-by-product', (0, validate_1.validate)({ query: reportQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => respond(req, res, {
        title: 'Product-wise Sales Report',
        filename: 'sales-by-product',
        columns: service.REPORT_COLUMNS.salesByProduct,
        result: await service.salesByProduct(resolveScope(req), req.query),
    })));
    router.get('/purchases', (0, validate_1.validate)({ query: reportQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => respond(req, res, {
        title: 'Purchase Report',
        filename: 'purchase-report',
        columns: service.REPORT_COLUMNS.purchase,
        result: await service.purchaseReport(resolveScope(req), req.query),
    })));
    router.get('/stock', (0, validate_1.validate)({ query: reportQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => respond(req, res, {
        title: 'Batch-wise Stock Report',
        filename: 'stock-report',
        columns: service.REPORT_COLUMNS.stock,
        result: await service.stockReport(resolveScope(req), req.query),
    })));
    router.get('/stock-movement', (0, validate_1.validate)({ query: reportQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => respond(req, res, {
        title: 'Stock Movement Report',
        filename: 'stock-movement',
        columns: service.REPORT_COLUMNS.stockMovement,
        result: await service.stockMovementReport(resolveScope(req), req.query),
    })));
    router.get('/low-stock', (0, validate_1.validate)({ query: reportQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => respond(req, res, {
        title: 'Low Stock Report',
        filename: 'low-stock',
        columns: service.REPORT_COLUMNS.lowStock,
        result: await service.lowStockReport(resolveScope(req)),
    })));
    router.get('/expiry', (0, validate_1.validate)({ query: reportQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => respond(req, res, {
        title: Number(req.query.days ?? 90) === 0
            ? 'Expired Stock Report'
            : `Expiry Report — next ${req.query.days ?? 90} days`,
        filename: 'expiry-report',
        columns: service.REPORT_COLUMNS.expiry,
        result: await service.expiryReport(resolveScope(req), req.query),
    })));
    router.get('/expiry-summary', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.expirySummaryReport(resolveScope(req)))));
    router.get('/orders', (0, validate_1.validate)({ query: reportQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.orderReport(resolveScope(req), req.query))));
    const base = tag === 'Vendor' ? '/vendor/reports' : tag === 'Retailer' ? '/retailer/reports' : '/admin/reports';
    (0, openapi_1.doc)('get', `${base}/sales`, { tags: [tag, 'Reports'], summary: 'Sales report (json/csv/excel/pdf)', query: reportQuery });
    (0, openapi_1.doc)('get', `${base}/sales-by-product`, { tags: [tag, 'Reports'], summary: 'Product-wise sales', query: reportQuery });
    (0, openapi_1.doc)('get', `${base}/purchases`, { tags: [tag, 'Reports'], summary: 'Purchase report', query: reportQuery });
    (0, openapi_1.doc)('get', `${base}/stock`, { tags: [tag, 'Reports'], summary: 'Batch-wise stock and valuation', query: reportQuery });
    (0, openapi_1.doc)('get', `${base}/stock-movement`, { tags: [tag, 'Reports'], summary: 'Stock movement ledger', query: reportQuery });
    (0, openapi_1.doc)('get', `${base}/low-stock`, { tags: [tag, 'Reports'], summary: 'Low and out-of-stock products', query: reportQuery });
    (0, openapi_1.doc)('get', `${base}/expiry`, { tags: [tag, 'Reports'], summary: 'Expiry report (days=0 for expired)', query: reportQuery });
    (0, openapi_1.doc)('get', `${base}/expiry-summary`, { tags: [tag, 'Reports'], summary: 'Expiry bucket counts and value at risk' });
    (0, openapi_1.doc)('get', `${base}/orders`, { tags: [tag, 'Reports'], summary: 'Order analytics by status, store and day', query: reportQuery });
    return router;
}
//# sourceMappingURL=report.routes.js.map
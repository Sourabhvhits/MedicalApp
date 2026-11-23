import { Router, type Request } from 'express';
import ExcelJS from 'exceljs';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, noContent, ok, paginated } from '../../utils/response';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/rbac';
import { auditFromRequest } from '../../lib/audit';
import { AUDIT_MODULES } from '../../config/constants';
import { PERMISSIONS } from '../../config/permissions';
import { exportQuery, idParam } from '../../common/query.validation';
import { doc } from '../../lib/openapi';
import { sendExport } from '../../utils/export';
import * as service from './finance.service';
import type { FinanceScope } from './finance.service';
import {
  expenseCreateSchema,
  expenseListQuery,
  expenseUpdateSchema,
  financePeriodQuery,
  financeTxnQuery,
  invoiceListQuery,
  manualPaymentSchema,
  paymentListQuery,
} from './finance.validation';

/**
 * Finance endpoints are identical for vendors and retailers; each mounts this
 * router with its own scope resolver.
 */
export function createFinanceRouter(resolveScope: (req: Request) => FinanceScope, tag: string): Router {
  const router = Router();

  router.get(
    '/summary',
    requirePermission(PERMISSIONS.FINANCE_VIEW),
    validate({ query: financePeriodQuery }),
    asyncHandler(async (req, res) => ok(res, await service.summary(resolveScope(req), req.query as never))),
  );

  router.get(
    '/transactions',
    requirePermission(PERMISSIONS.FINANCE_VIEW),
    validate({ query: financeTxnQuery }),
    asyncHandler(async (req, res) => {
      const result = await service.listTransactions(resolveScope(req), req.query as Record<string, unknown>);
      return res.json({
        success: true,
        message: 'Success',
        data: result.items,
        meta: result.meta,
        totals: result.totals,
      });
    }),
  );

  router.get(
    '/gst',
    requirePermission(PERMISSIONS.FINANCE_VIEW),
    validate({ query: financePeriodQuery }),
    asyncHandler(async (req, res) => ok(res, await service.gstReport(resolveScope(req), req.query as never))),
  );

  const gstFilingExportQuery = financePeriodQuery.merge(exportQuery);

  router.get(
    '/gst/gstr1',
    requirePermission(PERMISSIONS.FINANCE_VIEW),
    validate({ query: financePeriodQuery }),
    asyncHandler(async (req, res) => ok(res, await service.gstr1Report(resolveScope(req), req.query as never))),
  );

  router.get(
    '/gst/gstr1/export',
    requirePermission(PERMISSIONS.REPORT_EXPORT),
    validate({ query: gstFilingExportQuery }),
    asyncHandler(async (req, res) => {
      const report = await service.gstr1Report(resolveScope(req), req.query as never);
      const format = (req.query.format as 'json' | 'csv' | 'excel' | 'pdf') ?? 'excel';

      if (format === 'json') return ok(res, report);

      // GSTR-1 has three distinct sheets (B2B, B2C summary, HSN summary) with
      // different columns each — CSV can only hold one, so it gets the B2B
      // sheet (the one accountants reconcile against invoice-by-invoice) and
      // a note to use Excel for the full filing-ready set.
      if (format === 'csv') {
        return void sendExport(res, 'csv', {
          filename: 'gstr1-b2b',
          title: 'GSTR-1 — B2B invoices',
          columns: [
            { key: 'gstin', header: 'GSTIN/UIN of Recipient', width: 20 },
            { key: 'receiverName', header: 'Receiver Name', width: 24 },
            { key: 'invoiceNumber', header: 'Invoice Number', width: 18 },
            { key: 'invoiceDate', header: 'Invoice Date', width: 14 },
            { key: 'invoiceValue', header: 'Invoice Value', width: 14, numeric: true },
            { key: 'rate', header: 'Rate', width: 10, numeric: true },
            { key: 'taxableValue', header: 'Taxable Value', width: 14, numeric: true },
            { key: 'igst', header: 'Integrated Tax', width: 14, numeric: true },
            { key: 'cgst', header: 'Central Tax', width: 14, numeric: true },
            { key: 'sgst', header: 'State/UT Tax', width: 14, numeric: true },
          ],
          rows: report.b2b,
        });
      }

      const workbook = new ExcelJS.Workbook();
      workbook.created = new Date();

      const b2bSheet = workbook.addWorksheet('B2B');
      b2bSheet.columns = [
        { header: 'GSTIN/UIN of Recipient', key: 'gstin', width: 20 },
        { header: 'Receiver Name', key: 'receiverName', width: 24 },
        { header: 'Invoice Number', key: 'invoiceNumber', width: 18 },
        { header: 'Invoice Date', key: 'invoiceDate', width: 14 },
        { header: 'Invoice Value', key: 'invoiceValue', width: 14 },
        { header: 'Rate', key: 'rate', width: 10 },
        { header: 'Taxable Value', key: 'taxableValue', width: 14 },
        { header: 'Integrated Tax', key: 'igst', width: 14 },
        { header: 'Central Tax', key: 'cgst', width: 14 },
        { header: 'State/UT Tax', key: 'sgst', width: 14 },
      ];
      b2bSheet.getRow(1).font = { bold: true };
      report.b2b.forEach((row) => b2bSheet.addRow(row));

      const b2cSheet = workbook.addWorksheet('B2C Summary');
      b2cSheet.columns = [
        { header: 'Rate', key: 'rate', width: 10 },
        { header: 'Taxable Value', key: 'taxableValue', width: 16 },
        { header: 'Central Tax', key: 'cgst', width: 14 },
        { header: 'State/UT Tax', key: 'sgst', width: 14 },
      ];
      b2cSheet.getRow(1).font = { bold: true };
      report.b2cSummary.forEach((row) => b2cSheet.addRow(row));

      const hsnSheet = workbook.addWorksheet('HSN Summary');
      hsnSheet.columns = [
        { header: 'HSN', key: 'hsnCode', width: 14 },
        { header: 'Description', key: 'description', width: 28 },
        { header: 'UQC', key: 'unit', width: 10 },
        { header: 'Total Quantity', key: 'quantity', width: 14 },
        { header: 'Taxable Value', key: 'taxableValue', width: 16 },
        { header: 'Tax Amount', key: 'taxAmount', width: 14 },
      ];
      hsnSheet.getRow(1).font = { bold: true };
      report.hsnSummary.forEach((row) => hsnSheet.addRow(row));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="gstr1.xlsx"');
      await workbook.xlsx.write(res);
      res.end();
    }),
  );

  router.get(
    '/gst/gstr3b',
    requirePermission(PERMISSIONS.FINANCE_VIEW),
    validate({ query: financePeriodQuery }),
    asyncHandler(async (req, res) => ok(res, await service.gstr3bReport(resolveScope(req), req.query as never))),
  );

  router.get(
    '/gst/gstr3b/export',
    requirePermission(PERMISSIONS.REPORT_EXPORT),
    validate({ query: gstFilingExportQuery }),
    asyncHandler(async (req, res) => {
      const report = await service.gstr3bReport(resolveScope(req), req.query as never);
      const format = (req.query.format as 'json' | 'csv' | 'excel' | 'pdf') ?? 'excel';
      if (format === 'json') return ok(res, report);

      const handled = await sendExport(res, format === 'pdf' ? 'pdf' : format === 'csv' ? 'csv' : 'excel', {
        filename: 'gstr3b',
        title: 'GSTR-3B — 3.1(a) Outward taxable supplies',
        subtitle: `${report.period.from.toISOString().slice(0, 10)} to ${report.period.to.toISOString().slice(0, 10)}`,
        columns: [
          { key: 'rate', header: 'Rate (%)', width: 10, numeric: true },
          { key: 'taxableValue', header: 'Total Taxable Value', width: 18, numeric: true },
          { key: 'igst', header: 'Integrated Tax', width: 14, numeric: true },
          { key: 'cgst', header: 'Central Tax', width: 14, numeric: true },
          { key: 'sgst', header: 'State/UT Tax', width: 14, numeric: true },
        ],
        rows: report.outwardSupplies,
        totals: report.totals,
      });
      if (!handled) return ok(res, report);
    }),
  );

  // -------------------------------------------------------------------------
  // Expenses
  // -------------------------------------------------------------------------

  router.get(
    '/expenses',
    requirePermission(PERMISSIONS.FINANCE_VIEW),
    validate({ query: expenseListQuery }),
    asyncHandler(async (req, res) => {
      const result = await service.listExpenses(resolveScope(req), req.query as Record<string, unknown>);
      return res.json({
        success: true,
        message: 'Success',
        data: result.items,
        meta: result.meta,
        byCategory: result.byCategory,
      });
    }),
  );

  router.post(
    '/expenses',
    requirePermission(PERMISSIONS.FINANCE_MANAGE),
    validate({ body: expenseCreateSchema }),
    asyncHandler(async (req, res) => {
      const expense = await service.createExpense(resolveScope(req), req.body, req.user!.id);
      await auditFromRequest(req, {
        action: 'expense.create',
        module: AUDIT_MODULES.FINANCE,
        recordId: expense.id,
        newValue: expense,
      });
      return created(res, expense, 'Expense recorded');
    }),
  );

  router.put(
    '/expenses/:id',
    requirePermission(PERMISSIONS.FINANCE_MANAGE),
    validate({ params: idParam, body: expenseUpdateSchema }),
    asyncHandler(async (req, res) => {
      const expense = await service.updateExpense(resolveScope(req), req.params.id, req.body);
      await auditFromRequest(req, {
        action: 'expense.update',
        module: AUDIT_MODULES.FINANCE,
        recordId: expense.id,
        newValue: expense,
      });
      return ok(res, expense, 'Expense updated');
    }),
  );

  router.patch(
    '/expenses/:id/cancel-recurrence',
    requirePermission(PERMISSIONS.FINANCE_MANAGE),
    validate({ params: idParam }),
    asyncHandler(async (req, res) => {
      const expense = await service.cancelExpenseRecurrence(resolveScope(req), req.params.id);
      await auditFromRequest(req, {
        action: 'expense.cancel_recurrence',
        module: AUDIT_MODULES.FINANCE,
        recordId: expense.id,
        newValue: expense,
      });
      return ok(res, expense, 'Recurrence cancelled');
    }),
  );

  router.patch(
    '/expenses/:id/mark-paid',
    requirePermission(PERMISSIONS.FINANCE_MANAGE),
    validate({ params: idParam }),
    asyncHandler(async (req, res) => {
      const expense = await service.markExpensePaid(resolveScope(req), req.params.id);
      await auditFromRequest(req, {
        action: 'expense.mark_paid',
        module: AUDIT_MODULES.FINANCE,
        recordId: expense.id,
        newValue: expense,
      });
      return ok(res, expense, 'Expense marked as paid');
    }),
  );

  router.delete(
    '/expenses/:id',
    requirePermission(PERMISSIONS.FINANCE_MANAGE),
    validate({ params: idParam }),
    asyncHandler(async (req, res) => {
      await service.deleteExpense(resolveScope(req), req.params.id);
      await auditFromRequest(req, {
        action: 'expense.delete',
        module: AUDIT_MODULES.FINANCE,
        recordId: req.params.id,
      });
      return noContent(res, 'Expense deleted');
    }),
  );

  // -------------------------------------------------------------------------
  // Invoices & payments
  // -------------------------------------------------------------------------

  router.get(
    '/invoices',
    requirePermission(PERMISSIONS.FINANCE_VIEW),
    validate({ query: invoiceListQuery }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await service.listInvoices(resolveScope(req), req.query as Record<string, unknown>);
      return paginated(res, items, meta);
    }),
  );

  router.get(
    '/invoices/:id',
    requirePermission(PERMISSIONS.FINANCE_VIEW),
    validate({ params: idParam }),
    asyncHandler(async (req, res) => ok(res, await service.getInvoice(resolveScope(req), req.params.id))),
  );

  router.get(
    '/payments',
    requirePermission(PERMISSIONS.FINANCE_VIEW),
    validate({ query: paymentListQuery }),
    asyncHandler(async (req, res) => {
      const result = await service.listPayments(resolveScope(req), req.query as Record<string, unknown>);
      return res.json({
        success: true,
        message: 'Success',
        data: result.items,
        meta: result.meta,
        totals: result.totals,
      });
    }),
  );

  router.post(
    '/payments',
    requirePermission(PERMISSIONS.FINANCE_MANAGE),
    validate({ body: manualPaymentSchema }),
    asyncHandler(async (req, res) => {
      const payment = await service.recordPayment(resolveScope(req), req.body);
      await auditFromRequest(req, {
        action: 'payment.record',
        module: AUDIT_MODULES.FINANCE,
        recordId: payment.id,
        newValue: { amount: payment.amount, direction: payment.direction },
      });
      return created(res, payment, 'Payment recorded');
    }),
  );

  const base = tag === 'Vendor' ? '/vendor/finance' : '/retailer/finance';
  doc('get', `${base}/summary`, { tags: [tag], summary: 'Finance summary with profit & loss', query: financePeriodQuery });
  doc('get', `${base}/transactions`, { tags: [tag], summary: 'Finance ledger', query: financeTxnQuery, paginated: true });
  doc('get', `${base}/gst`, { tags: [tag], summary: 'GST summary (outward, inward, net payable)', query: financePeriodQuery });
  doc('get', `${base}/gst/gstr1`, { tags: [tag], summary: 'GSTR-1 preview (B2B, B2C summary, HSN summary)', query: financePeriodQuery });
  doc('get', `${base}/gst/gstr1/export`, { tags: [tag], summary: 'GSTR-1 filing-format export', query: gstFilingExportQuery });
  doc('get', `${base}/gst/gstr3b`, { tags: [tag], summary: 'GSTR-3B preview (3.1(a) outward taxable supplies)', query: financePeriodQuery });
  doc('get', `${base}/gst/gstr3b/export`, { tags: [tag], summary: 'GSTR-3B filing-format export', query: gstFilingExportQuery });
  doc('get', `${base}/expenses`, { tags: [tag], summary: 'List expenses with category totals', query: expenseListQuery, paginated: true });
  doc('post', `${base}/expenses`, { tags: [tag], summary: 'Record an expense', body: expenseCreateSchema });
  doc('put', `${base}/expenses/{id}`, { tags: [tag], summary: 'Update an expense', params: idParam, body: expenseUpdateSchema, status: 200 });
  doc('patch', `${base}/expenses/{id}/cancel-recurrence`, { tags: [tag], summary: 'Stop future occurrences of a recurring expense', params: idParam, status: 200 });
  doc('patch', `${base}/expenses/{id}/mark-paid`, { tags: [tag], summary: 'Confirm a pending expense occurrence as paid', params: idParam, status: 200 });
  doc('delete', `${base}/expenses/{id}`, { tags: [tag], summary: 'Delete an expense', params: idParam });
  doc('get', `${base}/invoices`, { tags: [tag], summary: 'List invoices', query: invoiceListQuery, paginated: true });
  doc('get', `${base}/invoices/{id}`, { tags: [tag], summary: 'Invoice detail for printing', params: idParam });
  doc('get', `${base}/payments`, { tags: [tag], summary: 'List payments in and out', query: paymentListQuery, paginated: true });
  doc('post', `${base}/payments`, { tags: [tag], summary: 'Record a standalone payment', body: manualPaymentSchema });

  return router;
}

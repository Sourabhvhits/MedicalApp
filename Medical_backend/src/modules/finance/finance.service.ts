import { Prisma, type RecurrenceInterval } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { buildMeta } from '../../utils/response';
import { getPagination } from '../../utils/pagination';
import { D, round2, toNumber } from '../../utils/money';
import { nextDocumentNumber } from '../../utils/numbering';
import { dayjs, endOfDay, startOfDay, toDateOnly } from '../../utils/time';
import { notify } from '../notifications/notification.service';
import { NOTIFICATION_EVENTS } from '../../config/constants';

export interface FinanceScope {
  ownerType: 'VENDOR' | 'RETAILER';
  vendorId?: string;
  retailerId?: string;
}

const ownerWhere = (scope: FinanceScope) =>
  scope.ownerType === 'VENDOR' ? { vendorId: scope.vendorId } : { retailerId: scope.retailerId };

const ownerSql = (scope: FinanceScope) =>
  scope.ownerType === 'VENDOR'
    ? Prisma.sql`vendorId = ${scope.vendorId}`
    : Prisma.sql`retailerId = ${scope.retailerId}`;

function dateWindow(query: { dateFrom?: Date; dateTo?: Date }) {
  const from = query.dateFrom ? startOfDay(query.dateFrom) : startOfDay(dayjs().startOf('month').toDate());
  const to = query.dateTo ? endOfDay(query.dateTo) : endOfDay();
  return { from, to };
}

// ---------------------------------------------------------------------------
// Summary & profit / loss
// ---------------------------------------------------------------------------

export async function summary(scope: FinanceScope, query: { dateFrom?: Date; dateTo?: Date }) {
  const { from, to } = dateWindow(query);

  const [sales, purchases, expenses, paymentsIn, paymentsOut, salesReturns, purchaseReturns] =
    await Promise.all([
      prisma.financeTransaction.aggregate({
        where: { ...ownerWhere(scope), type: 'SALE', txnDate: { gte: from, lte: to } },
        _sum: { amount: true, taxAmount: true },
        _count: true,
      }),
      prisma.financeTransaction.aggregate({
        where: { ...ownerWhere(scope), type: 'PURCHASE', txnDate: { gte: from, lte: to } },
        _sum: { amount: true, taxAmount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { ...ownerWhere(scope), expenseDate: { gte: from, lte: to } },
        _sum: { amount: true, taxAmount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { ...ownerWhere(scope), direction: 'IN', paidAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { ...ownerWhere(scope), direction: 'OUT', paidAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.financeTransaction.aggregate({
        where: { ...ownerWhere(scope), type: 'SALE_RETURN', txnDate: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.financeTransaction.aggregate({
        where: { ...ownerWhere(scope), type: 'PURCHASE_RETURN', txnDate: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
    ]);

  // Cost of goods sold comes from the batch cost captured on each sale line.
  const cogsRows =
    scope.ownerType === 'RETAILER'
      ? await prisma.$queryRaw<{ cogs: string }[]>`
          SELECT COALESCE(SUM(s.costAmount), 0) AS cogs
          FROM sales s
          WHERE s.retailerId = ${scope.retailerId} AND s.saleDate BETWEEN ${from} AND ${to}`
      : await prisma.$queryRaw<{ cogs: string }[]>`
          SELECT COALESCE(SUM(t.totalCost), 0) AS cogs
          FROM inventory_transactions t
          WHERE t.vendorId = ${scope.vendorId} AND t.type = 'SALE'
            AND t.createdAt BETWEEN ${from} AND ${to}`;

  const receivables = await outstanding(scope, 'IN');
  const payables = await outstanding(scope, 'OUT');

  const revenue = toNumber(sales._sum.amount ?? 0) - toNumber(salesReturns._sum.amount ?? 0);
  const cogs = Number(cogsRows[0]?.cogs ?? 0);
  const expenseTotal = toNumber(expenses._sum.amount ?? 0);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenseTotal;

  return {
    period: { from, to },
    sales: {
      count: sales._count,
      amount: toNumber(sales._sum.amount ?? 0),
      taxAmount: toNumber(sales._sum.taxAmount ?? 0),
      returns: toNumber(salesReturns._sum.amount ?? 0),
    },
    purchases: {
      count: purchases._count,
      amount: toNumber(purchases._sum.amount ?? 0),
      taxAmount: toNumber(purchases._sum.taxAmount ?? 0),
      returns: toNumber(purchaseReturns._sum.amount ?? 0),
    },
    expenses: { count: expenses._count, amount: expenseTotal },
    payments: {
      received: toNumber(paymentsIn._sum.amount ?? 0),
      paid: toNumber(paymentsOut._sum.amount ?? 0),
    },
    receivables,
    payables,
    profitAndLoss: {
      revenue: round2(revenue).toNumber(),
      costOfGoodsSold: round2(cogs).toNumber(),
      grossProfit: round2(grossProfit).toNumber(),
      expenses: round2(expenseTotal).toNumber(),
      netProfit: round2(netProfit).toNumber(),
      marginPct: revenue > 0 ? Number(((netProfit / revenue) * 100).toFixed(2)) : 0,
    },
  };
}

/** Outstanding receivables (money owed to us) or payables (money we owe). */
async function outstanding(scope: FinanceScope, direction: 'IN' | 'OUT') {
  if (scope.ownerType === 'VENDOR' && direction === 'IN') {
    const rows = await prisma.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(SUM(totalAmount - paidAmount), 0) AS total
      FROM purchase_orders
      WHERE vendorId = ${scope.vendorId}
        AND status NOT IN ('CANCELLED','REJECTED','DRAFT')
        AND totalAmount > paidAmount`;
    return Number(rows[0]?.total ?? 0);
  }

  if (scope.ownerType === 'RETAILER' && direction === 'OUT') {
    const rows = await prisma.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(SUM(totalAmount - paidAmount), 0) AS total
      FROM purchase_orders
      WHERE retailerId = ${scope.retailerId}
        AND status NOT IN ('CANCELLED','REJECTED','DRAFT')
        AND totalAmount > paidAmount`;
    return Number(rows[0]?.total ?? 0);
  }

  if (scope.ownerType === 'RETAILER' && direction === 'IN') {
    const rows = await prisma.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(SUM(totalAmount), 0) AS total
      FROM orders
      WHERE retailerId = ${scope.retailerId}
        AND paymentStatus IN ('PENDING','PARTIAL')
        AND status NOT IN ('CANCELLED','REJECTED','EXPIRED')`;
    return Number(rows[0]?.total ?? 0);
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export async function listTransactions(scope: FinanceScope, query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);
  const { from, to } = dateWindow(query as { dateFrom?: Date; dateTo?: Date });

  const where: Prisma.FinanceTransactionWhereInput = {
    ...ownerWhere(scope),
    txnDate: { gte: from, lte: to },
    ...(query.type ? { type: query.type as never } : {}),
  };

  const [items, total, totals] = await Promise.all([
    prisma.financeTransaction.findMany({
      where,
      orderBy: { txnDate: 'desc' },
      skip,
      take,
    }),
    prisma.financeTransaction.count({ where }),
    prisma.financeTransaction.groupBy({
      by: ['direction'],
      where,
      _sum: { amount: true },
    }),
  ]);

  return {
    items,
    meta: buildMeta(page, limit, total),
    totals: {
      in: toNumber(totals.find((row) => row.direction === 'IN')?._sum.amount ?? 0),
      out: toNumber(totals.find((row) => row.direction === 'OUT')?._sum.amount ?? 0),
    },
  };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function listExpenses(scope: FinanceScope, query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);
  const { from, to } = dateWindow(query as { dateFrom?: Date; dateTo?: Date });

  const where: Prisma.ExpenseWhereInput = {
    ...ownerWhere(scope),
    expenseDate: { gte: from, lte: to },
    ...(query.category ? { category: query.category as string } : {}),
    ...(query.status ? { status: query.status as 'PENDING' | 'PAID' } : {}),
    ...(query.search ? { title: { contains: query.search as string } } : {}),
  };

  const [items, total, grouped] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: { expenseDate: 'desc' }, skip, take }),
    prisma.expense.count({ where }),
    prisma.expense.groupBy({ by: ['category'], where, _sum: { amount: true }, _count: true }),
  ]);

  return {
    items,
    meta: buildMeta(page, limit, total),
    byCategory: grouped.map((row) => ({
      category: row.category,
      count: row._count,
      amount: toNumber(row._sum.amount ?? 0),
    })),
  };
}

/** `WEEKLY`/`MONTHLY`/`YEARLY` → the next occurrence date after `from`. */
function advanceDate(from: Date, interval: RecurrenceInterval): Date {
  const unit = interval === 'WEEKLY' ? 'week' : interval === 'MONTHLY' ? 'month' : 'year';
  return toDateOnly(dayjs(from).add(1, unit).toDate());
}

export async function createExpense(scope: FinanceScope, data: Record<string, unknown>, userId: string) {
  const isRecurring = Boolean(data.isRecurring);
  const recurrenceInterval = data.recurrenceInterval as RecurrenceInterval | undefined;
  const expenseDate = toDateOnly(data.expenseDate as Date);

  const expense = await prisma.expense.create({
    data: {
      ...data,
      ownerType: scope.ownerType,
      vendorId: scope.vendorId ?? null,
      retailerId: scope.retailerId ?? null,
      expenseDate,
      createdById: userId,
      status: 'PAID',
      isRecurring,
      recurrenceInterval: isRecurring ? recurrenceInterval : null,
      nextRecurrenceDate: isRecurring ? advanceDate(expenseDate, recurrenceInterval!) : null,
    } as never,
  });

  // A manually-recorded expense (recurring template or one-off) is already
  // settled — it's the auto-generated future occurrences (see
  // `generateDueRecurringExpenses`) that start PENDING and only hit the
  // ledger once marked paid.
  await prisma.financeTransaction.create({
    data: {
      ownerType: scope.ownerType,
      vendorId: scope.vendorId ?? null,
      retailerId: scope.retailerId ?? null,
      type: 'EXPENSE',
      direction: 'OUT',
      amount: expense.amount,
      taxAmount: expense.taxAmount,
      referenceType: 'EXPENSE',
      referenceId: expense.id,
      description: expense.title,
      txnDate: expense.expenseDate,
    },
  });

  return expense;
}

export async function updateExpense(scope: FinanceScope, id: string, data: Record<string, unknown>) {
  const existing = await prisma.expense.findFirst({ where: { id, ...ownerWhere(scope) } });
  if (!existing) throw ApiError.notFound('Expense not found');

  const recomputeRecurrence = data.isRecurring !== undefined || data.recurrenceInterval !== undefined;
  const isRecurring = recomputeRecurrence ? Boolean(data.isRecurring ?? existing.isRecurring) : undefined;
  const recurrenceInterval = (data.recurrenceInterval as RecurrenceInterval | undefined) ?? existing.recurrenceInterval ?? undefined;
  const expenseDate = data.expenseDate ? toDateOnly(data.expenseDate as Date) : existing.expenseDate;

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      ...data,
      ...(data.expenseDate ? { expenseDate } : {}),
      ...(recomputeRecurrence
        ? {
            isRecurring,
            recurrenceInterval: isRecurring ? recurrenceInterval : null,
            nextRecurrenceDate: isRecurring && recurrenceInterval ? advanceDate(expenseDate, recurrenceInterval) : null,
            recurrenceCancelledAt: isRecurring ? null : existing.recurrenceCancelledAt,
          }
        : {}),
    } as never,
  });

  await prisma.financeTransaction.updateMany({
    where: { referenceType: 'EXPENSE', referenceId: id },
    data: { amount: expense.amount, taxAmount: expense.taxAmount, description: expense.title },
  });

  return expense;
}

export async function deleteExpense(scope: FinanceScope, id: string) {
  const existing = await prisma.expense.findFirst({ where: { id, ...ownerWhere(scope) } });
  if (!existing) throw ApiError.notFound('Expense not found');

  await prisma.$transaction([
    prisma.financeTransaction.deleteMany({ where: { referenceType: 'EXPENSE', referenceId: id } }),
    prisma.expense.delete({ where: { id } }),
  ]);

  return { deleted: true };
}

/** Stops future occurrences of a recurring expense template — already-generated rows are untouched. */
export async function cancelExpenseRecurrence(scope: FinanceScope, id: string) {
  const existing = await prisma.expense.findFirst({ where: { id, ...ownerWhere(scope) } });
  if (!existing) throw ApiError.notFound('Expense not found');
  if (!existing.isRecurring) throw ApiError.badRequest('This expense is not set up as recurring');
  if (existing.recurrenceCancelledAt) throw ApiError.badRequest('Recurrence is already cancelled');

  return prisma.expense.update({
    where: { id },
    data: { recurrenceCancelledAt: new Date(), nextRecurrenceDate: null },
  });
}

/** Confirms a PENDING (auto-generated) expense occurrence was actually paid, and only then posts it to the ledger. */
export async function markExpensePaid(scope: FinanceScope, id: string) {
  const existing = await prisma.expense.findFirst({ where: { id, ...ownerWhere(scope) } });
  if (!existing) throw ApiError.notFound('Expense not found');
  if (existing.status === 'PAID') throw ApiError.badRequest('This expense is already marked paid');

  const expense = await prisma.expense.update({ where: { id }, data: { status: 'PAID' } });

  await prisma.financeTransaction.create({
    data: {
      ownerType: scope.ownerType,
      vendorId: scope.vendorId ?? null,
      retailerId: scope.retailerId ?? null,
      type: 'EXPENSE',
      direction: 'OUT',
      amount: expense.amount,
      taxAmount: expense.taxAmount,
      referenceType: 'EXPENSE',
      referenceId: expense.id,
      description: expense.title,
      txnDate: expense.expenseDate,
    },
  });

  return expense;
}

/**
 * Maintenance job (TASKS.md's recurring-expense ask): for every active
 * recurring template whose next occurrence is due, creates a PENDING child
 * expense (no ledger entry yet — that happens on `markExpensePaid`) and
 * advances the template to the following period. Cancelled templates
 * (`recurrenceCancelledAt` set) are excluded by the query itself.
 */
export async function generateDueRecurringExpenses(): Promise<number> {
  const today = toDateOnly(new Date());
  const due = await prisma.expense.findMany({
    where: { isRecurring: true, recurrenceCancelledAt: null, nextRecurrenceDate: { lte: today } },
  });

  let created = 0;
  for (const template of due) {
    if (!template.recurrenceInterval || !template.nextRecurrenceDate) continue;

    await prisma.expense.create({
      data: {
        ownerType: template.ownerType,
        vendorId: template.vendorId,
        retailerId: template.retailerId,
        category: template.category,
        title: template.title,
        amount: template.amount,
        taxAmount: template.taxAmount,
        expenseDate: template.nextRecurrenceDate,
        paymentMode: template.paymentMode,
        notes: template.notes,
        status: 'PENDING',
        isRecurring: false,
        parentExpenseId: template.id,
      },
    });

    await prisma.expense.update({
      where: { id: template.id },
      data: { nextRecurrenceDate: advanceDate(template.nextRecurrenceDate, template.recurrenceInterval) },
    });

    const owner = template.vendorId
      ? await prisma.vendor.findUnique({ where: { id: template.vendorId }, select: { userId: true } })
      : template.retailerId
        ? await prisma.retailer.findUnique({ where: { id: template.retailerId }, select: { userId: true } })
        : null;

    if (owner) {
      await notify({
        userId: owner.userId,
        event: NOTIFICATION_EVENTS.RECURRING_EXPENSE_DUE,
        title: 'Recurring expense due',
        body: `"${template.title}" (₹${toNumber(template.amount)}) is due this period — mark it paid once settled.`,
        data: { title: template.title, amount: toNumber(template.amount) },
        channels: ['IN_APP'],
        scope:
          template.ownerType === 'VENDOR'
            ? { vendorId: template.vendorId ?? undefined }
            : { retailerId: template.retailerId ?? undefined },
      });
    }

    created += 1;
  }

  return created;
}

// ---------------------------------------------------------------------------
// Invoices & payments
// ---------------------------------------------------------------------------

export async function listInvoices(scope: FinanceScope, query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.InvoiceWhereInput = {
    ...ownerWhere(scope),
    ...(query.type ? { type: query.type as never } : {}),
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.search ? { invoiceNumber: { contains: query.search as string } } : {}),
  };

  if (query.dateFrom || query.dateTo) {
    const { from, to } = dateWindow(query as { dateFrom?: Date; dateTo?: Date });
    where.invoiceDate = { gte: from, lte: to };
  }

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        order: { select: { orderNumber: true } },
        purchaseOrder: { select: { poNumber: true } },
      },
      orderBy: { invoiceDate: 'desc' },
      skip,
      take,
    }),
    prisma.invoice.count({ where }),
  ]);

  return { items, meta: buildMeta(page, limit, total) };
}

export async function getInvoice(scope: FinanceScope, id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, ...ownerWhere(scope) },
    include: {
      order: { include: { items: true, customer: { select: { user: { select: { firstName: true, lastName: true, phone: true } } } } } },
      purchaseOrder: { include: { items: true, retailer: { select: { storeName: true, gstNumber: true } } } },
      payments: { orderBy: { paidAt: 'desc' } },
      vendor: { select: { businessName: true, gstNumber: true, addressLine1: true, city: true, state: true, pincode: true, drugLicenseNumber: true } },
      retailer: { select: { storeName: true, gstNumber: true, addressLine1: true, city: true, state: true, pincode: true, drugLicenseNumber: true } },
    },
  });
  if (!invoice) throw ApiError.notFound('Invoice not found');
  return invoice;
}

export async function listPayments(scope: FinanceScope, query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);
  const { from, to } = dateWindow(query as { dateFrom?: Date; dateTo?: Date });

  const where: Prisma.PaymentWhereInput = {
    ...ownerWhere(scope),
    paidAt: { gte: from, lte: to },
    ...(query.direction ? { direction: query.direction as never } : {}),
    ...(query.mode ? { mode: query.mode as never } : {}),
  };

  const [items, total, totals] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        purchaseOrder: { select: { poNumber: true } },
        order: { select: { orderNumber: true } },
      },
      orderBy: { paidAt: 'desc' },
      skip,
      take,
    }),
    prisma.payment.count({ where }),
    prisma.payment.groupBy({ by: ['direction'], where, _sum: { amount: true } }),
  ]);

  return {
    items,
    meta: buildMeta(page, limit, total),
    totals: {
      received: toNumber(totals.find((row) => row.direction === 'IN')?._sum.amount ?? 0),
      paid: toNumber(totals.find((row) => row.direction === 'OUT')?._sum.amount ?? 0),
    },
  };
}

/** Standalone payment entry (counter collection, advance, ad-hoc settlement). */
export async function recordPayment(scope: FinanceScope, data: Record<string, unknown>) {
  return prisma.$transaction(async (tx) => {
    const paymentNumber = await nextDocumentNumber(tx, 'payment');

    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        ownerType: scope.ownerType,
        vendorId: scope.vendorId ?? null,
        retailerId: scope.retailerId ?? null,
        direction: data.direction as never,
        mode: data.mode as never,
        amount: D(data.amount as number),
        status: 'PAID',
        referenceNo: (data.referenceNo as string) ?? null,
        paidAt: (data.paidAt as Date) ?? new Date(),
        notes: (data.notes as string) ?? null,
      },
    });

    await tx.financeTransaction.create({
      data: {
        ownerType: scope.ownerType,
        vendorId: scope.vendorId ?? null,
        retailerId: scope.retailerId ?? null,
        type: data.direction === 'IN' ? 'PAYMENT_IN' : 'PAYMENT_OUT',
        direction: data.direction as never,
        amount: payment.amount,
        referenceType: 'PAYMENT',
        referenceId: payment.id,
        partyName: (data.partyName as string) ?? null,
        description: (data.notes as string) ?? 'Manual payment entry',
        txnDate: payment.paidAt,
      },
    });

    return payment;
  });
}

// ---------------------------------------------------------------------------
// GST
// ---------------------------------------------------------------------------

/**
 * A vendor's own outward supply is recorded as `type: 'PURCHASE'` (the
 * document category — it's raised off a purchase order) with
 * `ownerType: 'VENDOR'`; a retailer's outward supply is `type: 'SALES'` with
 * `ownerType: 'RETAILER'` — see `purchase.service.ts` (dispatch → invoice)
 * vs `order.service.ts#createSaleRecord`. Confirmed against live data
 * (`invoice.groupBy(['ownerType','type'])` returns exactly those two
 * combinations, never `{VENDOR, SALES}`) while building #8 — the type
 * naming reads like "this owner's sale" but actually means "this
 * transaction's document category", which is an easy trap for any new query
 * over `invoices` to fall into.
 */
const outwardInvoiceType = (scope: FinanceScope) => (scope.ownerType === 'VENDOR' ? 'PURCHASE' : 'SALES');

/** Outward taxable supply grouped by GST rate — shared by the summary GST
 * report and the GSTR-3B export's 3.1(a) table. */
async function outwardRateWise(scope: FinanceScope, from: Date, to: Date) {
  const rows =
    scope.ownerType === 'RETAILER'
      ? await prisma.$queryRaw<{ gstRate: string; taxable: string; tax: string; cgst: string; sgst: string; igst: string }[]>`
          SELECT oi.gstRate AS gstRate,
                 COALESCE(SUM(oi.taxableAmount), 0) AS taxable,
                 COALESCE(SUM(oi.taxAmount), 0) AS tax,
                 COALESCE(SUM(o.cgstAmount * oi.taxableAmount / NULLIF(o.taxableAmount, 0)), 0) AS cgst,
                 COALESCE(SUM(o.sgstAmount * oi.taxableAmount / NULLIF(o.taxableAmount, 0)), 0) AS sgst,
                 COALESCE(SUM(o.igstAmount * oi.taxableAmount / NULLIF(o.taxableAmount, 0)), 0) AS igst
          FROM order_items oi
          JOIN orders o ON o.id = oi.orderId
          WHERE o.retailerId = ${scope.retailerId ?? ''}
            AND o.status IN ('PICKED_UP','DELIVERED','COMPLETED')
            AND o.createdAt BETWEEN ${from} AND ${to}
          GROUP BY oi.gstRate ORDER BY oi.gstRate ASC`
      : await prisma.$queryRaw<{ gstRate: string; taxable: string; tax: string; cgst: string; sgst: string; igst: string }[]>`
          SELECT poi.gstRate AS gstRate,
                 COALESCE(SUM(poi.taxableAmount), 0) AS taxable,
                 COALESCE(SUM(poi.taxAmount), 0) AS tax,
                 COALESCE(SUM(po.cgstAmount * poi.taxableAmount / NULLIF(po.taxableAmount, 0)), 0) AS cgst,
                 COALESCE(SUM(po.sgstAmount * poi.taxableAmount / NULLIF(po.taxableAmount, 0)), 0) AS sgst,
                 COALESCE(SUM(po.igstAmount * poi.taxableAmount / NULLIF(po.taxableAmount, 0)), 0) AS igst
          FROM purchase_order_items poi
          JOIN purchase_orders po ON po.id = poi.purchaseOrderId
          WHERE po.vendorId = ${scope.vendorId ?? ''}
            AND po.status IN ('DISPATCHED','DELIVERED','RECEIVED','COMPLETED')
            AND po.createdAt BETWEEN ${from} AND ${to}
          GROUP BY poi.gstRate ORDER BY poi.gstRate ASC`;

  return rows.map((row) => ({
    gstRate: Number(row.gstRate),
    taxableAmount: Number(row.taxable),
    taxAmount: Number(row.tax),
    cgstAmount: Number(row.cgst),
    sgstAmount: Number(row.sgst),
    igstAmount: Number(row.igst),
  }));
}

export async function gstReport(scope: FinanceScope, query: { dateFrom?: Date; dateTo?: Date }) {
  const { from, to } = dateWindow(query);

  const outward = await prisma.$queryRaw<
    { taxable: string; cgst: string; sgst: string; igst: string; total: string; count: bigint }[]
  >`
    SELECT COALESCE(SUM(taxableAmount), 0) AS taxable,
           COALESCE(SUM(cgstAmount), 0) AS cgst,
           COALESCE(SUM(sgstAmount), 0) AS sgst,
           COALESCE(SUM(igstAmount), 0) AS igst,
           COALESCE(SUM(totalAmount), 0) AS total,
           COUNT(*) AS count
    FROM invoices
    WHERE ${ownerSql(scope)} AND type = ${outwardInvoiceType(scope)} AND invoiceDate BETWEEN ${from} AND ${to}`;

  const inward = await prisma.$queryRaw<
    { taxable: string; cgst: string; sgst: string; igst: string; total: string; count: bigint }[]
  >`
    SELECT COALESCE(SUM(po.taxableAmount), 0) AS taxable,
           COALESCE(SUM(po.cgstAmount), 0) AS cgst,
           COALESCE(SUM(po.sgstAmount), 0) AS sgst,
           COALESCE(SUM(po.igstAmount), 0) AS igst,
           COALESCE(SUM(po.totalAmount), 0) AS total,
           COUNT(*) AS count
    FROM purchase_orders po
    WHERE po.${scope.ownerType === 'VENDOR' ? Prisma.raw('vendorId') : Prisma.raw('retailerId')} = ${
      scope.ownerType === 'VENDOR' ? scope.vendorId : scope.retailerId
    }
      AND po.status IN ('RECEIVED','COMPLETED','DELIVERED')
      AND po.createdAt BETWEEN ${from} AND ${to}`;

  // Retailer's outward line items are `order_items` (customer sales);
  // vendor's are `purchase_order_items` (PO fulfilment) — this previously
  // only queried `order_items`, so a vendor's rate-wise breakdown was always
  // empty, the same class of bug as the outward-totals one above.
  const rateWise = await outwardRateWise(scope, from, to);

  const shape = (row?: { taxable: string; cgst: string; sgst: string; igst: string; total: string; count: bigint }) => ({
    invoices: Number(row?.count ?? 0),
    taxableAmount: Number(row?.taxable ?? 0),
    cgstAmount: Number(row?.cgst ?? 0),
    sgstAmount: Number(row?.sgst ?? 0),
    igstAmount: Number(row?.igst ?? 0),
    totalTax: Number(row?.cgst ?? 0) + Number(row?.sgst ?? 0) + Number(row?.igst ?? 0),
    totalAmount: Number(row?.total ?? 0),
  });

  const outwardTotals = shape(outward[0]);
  const inwardTotals = shape(inward[0]);

  return {
    period: { from, to },
    outward: outwardTotals,
    inward: inwardTotals,
    netPayable: round2(outwardTotals.totalTax - inwardTotals.totalTax).toNumber(),
    rateWise: rateWise.map((row) => ({
      gstRate: row.gstRate,
      taxableAmount: row.taxableAmount,
      taxAmount: row.taxAmount,
    })),
  };
}

// ---------------------------------------------------------------------------
// GSTR-1 / GSTR-3B export (TASKS.md #8)
//
// These format the same underlying figures `gstReport()` already computes
// correctly into the column layouts accountants recognise from the GSTR
// filing portal/offline tool — NOT a byte-for-byte replica of the government
// JSON schema, which is a much deeper, versioned target than "add an export
// format" scoped for. Scoped as: GSTR-1 B2B (per invoice, split by rate
// where an invoice mixes rates — a real invoice commonly does, so
// invoice-level-only would misreport), GSTR-1 B2C summary (this platform
// only supports pickup, never delivery — see TASKS.md Priority 3 — so every
// retailer sale's place of supply is the retailer's own state, i.e.
// intra-state; B2C(Large)'s inter-state trigger never applies here), a HSN
// summary (both scopes), and GSTR-3B's table 3.1(a) (reuses the same
// `outwardRateWise` the summary GST report uses).
// ---------------------------------------------------------------------------

/** GSTR-1 B2B — one row per (invoice, GST rate) since a real invoice
 * commonly mixes rates. Only invoices with a recipient GSTIN qualify; for a
 * vendor scope that's effectively every outward invoice (their customers are
 * GST-registered retailers), for a retailer scope it's normally none (their
 * customers are individual consumers) — computed from the data, not assumed
 * either way. */
async function gstr1B2B(scope: FinanceScope, from: Date, to: Date) {
  const invoiceType = outwardInvoiceType(scope);

  const invoices = await prisma.invoice.findMany({
    where: {
      ...ownerWhere(scope),
      type: invoiceType as never,
      invoiceDate: { gte: from, lte: to },
      billToGst: { not: null },
    },
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      totalAmount: true,
      billToName: true,
      billToGst: true,
      orderId: true,
      purchaseOrderId: true,
    },
    orderBy: { invoiceDate: 'asc' },
  });

  const rows: {
    gstin: string;
    receiverName: string;
    invoiceNumber: string;
    invoiceDate: Date;
    invoiceValue: number;
    rate: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
  }[] = [];

  for (const invoice of invoices) {
    const items =
      scope.ownerType === 'RETAILER'
        ? await prisma.orderItem.findMany({
            where: { orderId: invoice.orderId ?? '' },
            select: { gstRate: true, taxableAmount: true, taxAmount: true },
          })
        : await prisma.purchaseOrderItem.findMany({
            where: { purchaseOrderId: invoice.purchaseOrderId ?? '' },
            select: { gstRate: true, taxableAmount: true, taxAmount: true },
          });

    const byRate = new Map<number, { taxable: number; tax: number }>();
    for (const item of items) {
      const rate = toNumber(item.gstRate);
      const entry = byRate.get(rate) ?? { taxable: 0, tax: 0 };
      entry.taxable += toNumber(item.taxableAmount);
      entry.tax += toNumber(item.taxAmount);
      byRate.set(rate, entry);
    }

    // Every order/PO in this schema is fulfilled from the seller's own
    // store/warehouse to a buyer collecting or receiving in the same state
    // (no inter-state delivery modelled yet), so every line here is
    // intra-state — split evenly into CGST + SGST, never IGST.
    for (const [rate, { taxable, tax }] of byRate) {
      rows.push({
        gstin: invoice.billToGst!,
        receiverName: invoice.billToName ?? '',
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        invoiceValue: toNumber(invoice.totalAmount),
        rate,
        taxableValue: round2(taxable).toNumber(),
        igst: 0,
        cgst: round2(D(tax).div(2)).toNumber(),
        sgst: round2(D(tax).div(2)).toNumber(),
      });
    }
  }

  return rows;
}

/** GSTR-1 B2C summary — rate-wise totals for outward invoices with no
 * recipient GSTIN (the complement of `gstr1B2B`, queried directly rather
 * than derived by subtraction so the two can't drift out of sync).
 * Collapses to one "place of supply" (the seller's own state) for the
 * reason `gstr1B2B` documents above. */
async function gstr1B2CSummary(scope: FinanceScope, from: Date, to: Date) {
  const rows =
    scope.ownerType === 'RETAILER'
      ? await prisma.$queryRaw<{ gstRate: string; taxable: string; tax: string }[]>`
          SELECT oi.gstRate AS gstRate,
                 COALESCE(SUM(oi.taxableAmount), 0) AS taxable,
                 COALESCE(SUM(oi.taxAmount), 0) AS tax
          FROM order_items oi
          JOIN orders o ON o.id = oi.orderId
          JOIN invoices inv ON inv.orderId = o.id
          WHERE o.retailerId = ${scope.retailerId ?? ''}
            AND o.status IN ('PICKED_UP','DELIVERED','COMPLETED')
            AND o.createdAt BETWEEN ${from} AND ${to}
            AND inv.billToGst IS NULL
          GROUP BY oi.gstRate ORDER BY oi.gstRate ASC`
      : await prisma.$queryRaw<{ gstRate: string; taxable: string; tax: string }[]>`
          SELECT poi.gstRate AS gstRate,
                 COALESCE(SUM(poi.taxableAmount), 0) AS taxable,
                 COALESCE(SUM(poi.taxAmount), 0) AS tax
          FROM purchase_order_items poi
          JOIN purchase_orders po ON po.id = poi.purchaseOrderId
          JOIN invoices inv ON inv.purchaseOrderId = po.id
          WHERE po.vendorId = ${scope.vendorId ?? ''}
            AND po.status IN ('DISPATCHED','DELIVERED','RECEIVED','COMPLETED')
            AND po.createdAt BETWEEN ${from} AND ${to}
            AND inv.billToGst IS NULL
          GROUP BY poi.gstRate ORDER BY poi.gstRate ASC`;

  return rows.map((row) => ({
    rate: Number(row.gstRate),
    taxableValue: round2(D(row.taxable)).toNumber(),
    cgst: round2(D(row.tax).div(2)).toNumber(),
    sgst: round2(D(row.tax).div(2)).toNumber(),
  }));
}

/** HSN-wise summary (GSTR-1's HSN sheet) — both scopes. */
async function gstr1HsnSummary(scope: FinanceScope, from: Date, to: Date) {
  const rows =
    scope.ownerType === 'RETAILER'
      ? await prisma.$queryRaw<
          { hsnCode: string | null; description: string; unit: string | null; quantity: bigint; taxable: string; tax: string }[]
        >`
          SELECT p.hsnCode AS hsnCode, p.name AS description, u.code AS unit,
                 COALESCE(SUM(oi.quantity), 0) AS quantity,
                 COALESCE(SUM(oi.taxableAmount), 0) AS taxable,
                 COALESCE(SUM(oi.taxAmount), 0) AS tax
          FROM order_items oi
          JOIN orders o ON o.id = oi.orderId
          JOIN products p ON p.id = oi.productId
          LEFT JOIN product_units u ON u.id = p.unitId
          WHERE o.retailerId = ${scope.retailerId ?? ''}
            AND o.status IN ('PICKED_UP','DELIVERED','COMPLETED')
            AND o.createdAt BETWEEN ${from} AND ${to}
          GROUP BY p.hsnCode, p.name, u.code ORDER BY p.hsnCode ASC`
      : await prisma.$queryRaw<
          { hsnCode: string | null; description: string; unit: string | null; quantity: bigint; taxable: string; tax: string }[]
        >`
          SELECT p.hsnCode AS hsnCode, p.name AS description, u.code AS unit,
                 COALESCE(SUM(poi.quantity), 0) AS quantity,
                 COALESCE(SUM(poi.taxableAmount), 0) AS taxable,
                 COALESCE(SUM(poi.taxAmount), 0) AS tax
          FROM purchase_order_items poi
          JOIN purchase_orders po ON po.id = poi.purchaseOrderId
          JOIN products p ON p.id = poi.productId
          LEFT JOIN product_units u ON u.id = p.unitId
          WHERE po.vendorId = ${scope.vendorId ?? ''}
            AND po.status IN ('DISPATCHED','DELIVERED','RECEIVED','COMPLETED')
            AND po.createdAt BETWEEN ${from} AND ${to}
          GROUP BY p.hsnCode, p.name, u.code ORDER BY p.hsnCode ASC`;

  return rows.map((row) => ({
    hsnCode: row.hsnCode ?? 'N/A',
    description: row.description,
    unit: row.unit ?? 'NOS',
    quantity: Number(row.quantity),
    taxableValue: round2(D(row.taxable)).toNumber(),
    taxAmount: round2(D(row.tax)).toNumber(),
  }));
}

export async function gstr1Report(scope: FinanceScope, query: { dateFrom?: Date; dateTo?: Date }) {
  const { from, to } = dateWindow(query);
  const [b2b, b2cSummary, hsnSummary] = await Promise.all([
    gstr1B2B(scope, from, to),
    gstr1B2CSummary(scope, from, to),
    gstr1HsnSummary(scope, from, to),
  ]);
  return { period: { from, to }, b2b, b2cSummary, hsnSummary };
}

export async function gstr3bReport(scope: FinanceScope, query: { dateFrom?: Date; dateTo?: Date }) {
  const { from, to } = dateWindow(query);
  const rateWise = await outwardRateWise(scope, from, to);

  const totals = rateWise.reduce(
    (acc, row) => ({
      taxableValue: acc.taxableValue + row.taxableAmount,
      igst: acc.igst + row.igstAmount,
      cgst: acc.cgst + row.cgstAmount,
      sgst: acc.sgst + row.sgstAmount,
    }),
    { taxableValue: 0, igst: 0, cgst: 0, sgst: 0 },
  );

  return {
    period: { from, to },
    outwardSupplies: rateWise.map((row) => ({
      rate: row.gstRate,
      taxableValue: row.taxableAmount,
      igst: row.igstAmount,
      cgst: row.cgstAmount,
      sgst: row.sgstAmount,
    })),
    totals: {
      taxableValue: round2(D(totals.taxableValue)).toNumber(),
      igst: round2(D(totals.igst)).toNumber(),
      cgst: round2(D(totals.cgst)).toNumber(),
      sgst: round2(D(totals.sgst)).toNumber(),
      totalTax: round2(D(totals.igst).add(totals.cgst).add(totals.sgst)).toNumber(),
    },
  };
}

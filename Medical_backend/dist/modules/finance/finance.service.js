"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summary = summary;
exports.listTransactions = listTransactions;
exports.listExpenses = listExpenses;
exports.createExpense = createExpense;
exports.updateExpense = updateExpense;
exports.deleteExpense = deleteExpense;
exports.listInvoices = listInvoices;
exports.getInvoice = getInvoice;
exports.listPayments = listPayments;
exports.recordPayment = recordPayment;
exports.gstReport = gstReport;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../database/prisma");
const ApiError_1 = require("../../utils/ApiError");
const response_1 = require("../../utils/response");
const pagination_1 = require("../../utils/pagination");
const money_1 = require("../../utils/money");
const numbering_1 = require("../../utils/numbering");
const time_1 = require("../../utils/time");
const ownerWhere = (scope) => scope.ownerType === 'VENDOR' ? { vendorId: scope.vendorId } : { retailerId: scope.retailerId };
const ownerSql = (scope) => scope.ownerType === 'VENDOR'
    ? client_1.Prisma.sql `vendorId = ${scope.vendorId}`
    : client_1.Prisma.sql `retailerId = ${scope.retailerId}`;
function dateWindow(query) {
    const from = query.dateFrom ? (0, time_1.startOfDay)(query.dateFrom) : (0, time_1.startOfDay)((0, time_1.dayjs)().startOf('month').toDate());
    const to = query.dateTo ? (0, time_1.endOfDay)(query.dateTo) : (0, time_1.endOfDay)();
    return { from, to };
}
// ---------------------------------------------------------------------------
// Summary & profit / loss
// ---------------------------------------------------------------------------
async function summary(scope, query) {
    const { from, to } = dateWindow(query);
    const [sales, purchases, expenses, paymentsIn, paymentsOut, salesReturns, purchaseReturns] = await Promise.all([
        prisma_1.prisma.financeTransaction.aggregate({
            where: { ...ownerWhere(scope), type: 'SALE', txnDate: { gte: from, lte: to } },
            _sum: { amount: true, taxAmount: true },
            _count: true,
        }),
        prisma_1.prisma.financeTransaction.aggregate({
            where: { ...ownerWhere(scope), type: 'PURCHASE', txnDate: { gte: from, lte: to } },
            _sum: { amount: true, taxAmount: true },
            _count: true,
        }),
        prisma_1.prisma.expense.aggregate({
            where: { ...ownerWhere(scope), expenseDate: { gte: from, lte: to } },
            _sum: { amount: true, taxAmount: true },
            _count: true,
        }),
        prisma_1.prisma.payment.aggregate({
            where: { ...ownerWhere(scope), direction: 'IN', paidAt: { gte: from, lte: to } },
            _sum: { amount: true },
        }),
        prisma_1.prisma.payment.aggregate({
            where: { ...ownerWhere(scope), direction: 'OUT', paidAt: { gte: from, lte: to } },
            _sum: { amount: true },
        }),
        prisma_1.prisma.financeTransaction.aggregate({
            where: { ...ownerWhere(scope), type: 'SALE_RETURN', txnDate: { gte: from, lte: to } },
            _sum: { amount: true },
        }),
        prisma_1.prisma.financeTransaction.aggregate({
            where: { ...ownerWhere(scope), type: 'PURCHASE_RETURN', txnDate: { gte: from, lte: to } },
            _sum: { amount: true },
        }),
    ]);
    // Cost of goods sold comes from the batch cost captured on each sale line.
    const cogsRows = scope.ownerType === 'RETAILER'
        ? await prisma_1.prisma.$queryRaw `
          SELECT COALESCE(SUM(s.costAmount), 0) AS cogs
          FROM sales s
          WHERE s.retailerId = ${scope.retailerId} AND s.saleDate BETWEEN ${from} AND ${to}`
        : await prisma_1.prisma.$queryRaw `
          SELECT COALESCE(SUM(t.totalCost), 0) AS cogs
          FROM inventory_transactions t
          WHERE t.vendorId = ${scope.vendorId} AND t.type = 'SALE'
            AND t.createdAt BETWEEN ${from} AND ${to}`;
    const receivables = await outstanding(scope, 'IN');
    const payables = await outstanding(scope, 'OUT');
    const revenue = (0, money_1.toNumber)(sales._sum.amount ?? 0) - (0, money_1.toNumber)(salesReturns._sum.amount ?? 0);
    const cogs = Number(cogsRows[0]?.cogs ?? 0);
    const expenseTotal = (0, money_1.toNumber)(expenses._sum.amount ?? 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenseTotal;
    return {
        period: { from, to },
        sales: {
            count: sales._count,
            amount: (0, money_1.toNumber)(sales._sum.amount ?? 0),
            taxAmount: (0, money_1.toNumber)(sales._sum.taxAmount ?? 0),
            returns: (0, money_1.toNumber)(salesReturns._sum.amount ?? 0),
        },
        purchases: {
            count: purchases._count,
            amount: (0, money_1.toNumber)(purchases._sum.amount ?? 0),
            taxAmount: (0, money_1.toNumber)(purchases._sum.taxAmount ?? 0),
            returns: (0, money_1.toNumber)(purchaseReturns._sum.amount ?? 0),
        },
        expenses: { count: expenses._count, amount: expenseTotal },
        payments: {
            received: (0, money_1.toNumber)(paymentsIn._sum.amount ?? 0),
            paid: (0, money_1.toNumber)(paymentsOut._sum.amount ?? 0),
        },
        receivables,
        payables,
        profitAndLoss: {
            revenue: (0, money_1.round2)(revenue).toNumber(),
            costOfGoodsSold: (0, money_1.round2)(cogs).toNumber(),
            grossProfit: (0, money_1.round2)(grossProfit).toNumber(),
            expenses: (0, money_1.round2)(expenseTotal).toNumber(),
            netProfit: (0, money_1.round2)(netProfit).toNumber(),
            marginPct: revenue > 0 ? Number(((netProfit / revenue) * 100).toFixed(2)) : 0,
        },
    };
}
/** Outstanding receivables (money owed to us) or payables (money we owe). */
async function outstanding(scope, direction) {
    if (scope.ownerType === 'VENDOR' && direction === 'IN') {
        const rows = await prisma_1.prisma.$queryRaw `
      SELECT COALESCE(SUM(totalAmount - paidAmount), 0) AS total
      FROM purchase_orders
      WHERE vendorId = ${scope.vendorId}
        AND status NOT IN ('CANCELLED','REJECTED','DRAFT')
        AND totalAmount > paidAmount`;
        return Number(rows[0]?.total ?? 0);
    }
    if (scope.ownerType === 'RETAILER' && direction === 'OUT') {
        const rows = await prisma_1.prisma.$queryRaw `
      SELECT COALESCE(SUM(totalAmount - paidAmount), 0) AS total
      FROM purchase_orders
      WHERE retailerId = ${scope.retailerId}
        AND status NOT IN ('CANCELLED','REJECTED','DRAFT')
        AND totalAmount > paidAmount`;
        return Number(rows[0]?.total ?? 0);
    }
    if (scope.ownerType === 'RETAILER' && direction === 'IN') {
        const rows = await prisma_1.prisma.$queryRaw `
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
async function listTransactions(scope, query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const { from, to } = dateWindow(query);
    const where = {
        ...ownerWhere(scope),
        txnDate: { gte: from, lte: to },
        ...(query.type ? { type: query.type } : {}),
    };
    const [items, total, totals] = await Promise.all([
        prisma_1.prisma.financeTransaction.findMany({
            where,
            orderBy: { txnDate: 'desc' },
            skip,
            take,
        }),
        prisma_1.prisma.financeTransaction.count({ where }),
        prisma_1.prisma.financeTransaction.groupBy({
            by: ['direction'],
            where,
            _sum: { amount: true },
        }),
    ]);
    return {
        items,
        meta: (0, response_1.buildMeta)(page, limit, total),
        totals: {
            in: (0, money_1.toNumber)(totals.find((row) => row.direction === 'IN')?._sum.amount ?? 0),
            out: (0, money_1.toNumber)(totals.find((row) => row.direction === 'OUT')?._sum.amount ?? 0),
        },
    };
}
// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
async function listExpenses(scope, query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const { from, to } = dateWindow(query);
    const where = {
        ...ownerWhere(scope),
        expenseDate: { gte: from, lte: to },
        ...(query.category ? { category: query.category } : {}),
        ...(query.search ? { title: { contains: query.search } } : {}),
    };
    const [items, total, grouped] = await Promise.all([
        prisma_1.prisma.expense.findMany({ where, orderBy: { expenseDate: 'desc' }, skip, take }),
        prisma_1.prisma.expense.count({ where }),
        prisma_1.prisma.expense.groupBy({ by: ['category'], where, _sum: { amount: true }, _count: true }),
    ]);
    return {
        items,
        meta: (0, response_1.buildMeta)(page, limit, total),
        byCategory: grouped.map((row) => ({
            category: row.category,
            count: row._count,
            amount: (0, money_1.toNumber)(row._sum.amount ?? 0),
        })),
    };
}
async function createExpense(scope, data, userId) {
    const expense = await prisma_1.prisma.expense.create({
        data: {
            ...data,
            ownerType: scope.ownerType,
            vendorId: scope.vendorId ?? null,
            retailerId: scope.retailerId ?? null,
            expenseDate: (0, time_1.toDateOnly)(data.expenseDate),
            createdById: userId,
        },
    });
    await prisma_1.prisma.financeTransaction.create({
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
async function updateExpense(scope, id, data) {
    const existing = await prisma_1.prisma.expense.findFirst({ where: { id, ...ownerWhere(scope) } });
    if (!existing)
        throw ApiError_1.ApiError.notFound('Expense not found');
    const expense = await prisma_1.prisma.expense.update({
        where: { id },
        data: {
            ...data,
            ...(data.expenseDate ? { expenseDate: (0, time_1.toDateOnly)(data.expenseDate) } : {}),
        },
    });
    await prisma_1.prisma.financeTransaction.updateMany({
        where: { referenceType: 'EXPENSE', referenceId: id },
        data: { amount: expense.amount, taxAmount: expense.taxAmount, description: expense.title },
    });
    return expense;
}
async function deleteExpense(scope, id) {
    const existing = await prisma_1.prisma.expense.findFirst({ where: { id, ...ownerWhere(scope) } });
    if (!existing)
        throw ApiError_1.ApiError.notFound('Expense not found');
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.financeTransaction.deleteMany({ where: { referenceType: 'EXPENSE', referenceId: id } }),
        prisma_1.prisma.expense.delete({ where: { id } }),
    ]);
    return { deleted: true };
}
// ---------------------------------------------------------------------------
// Invoices & payments
// ---------------------------------------------------------------------------
async function listInvoices(scope, query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = {
        ...ownerWhere(scope),
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search ? { invoiceNumber: { contains: query.search } } : {}),
    };
    if (query.dateFrom || query.dateTo) {
        const { from, to } = dateWindow(query);
        where.invoiceDate = { gte: from, lte: to };
    }
    const [items, total] = await Promise.all([
        prisma_1.prisma.invoice.findMany({
            where,
            include: {
                order: { select: { orderNumber: true } },
                purchaseOrder: { select: { poNumber: true } },
            },
            orderBy: { invoiceDate: 'desc' },
            skip,
            take,
        }),
        prisma_1.prisma.invoice.count({ where }),
    ]);
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
async function getInvoice(scope, id) {
    const invoice = await prisma_1.prisma.invoice.findFirst({
        where: { id, ...ownerWhere(scope) },
        include: {
            order: { include: { items: true, customer: { select: { user: { select: { firstName: true, lastName: true, phone: true } } } } } },
            purchaseOrder: { include: { items: true, retailer: { select: { storeName: true, gstNumber: true } } } },
            payments: { orderBy: { paidAt: 'desc' } },
            vendor: { select: { businessName: true, gstNumber: true, addressLine1: true, city: true, state: true, pincode: true, drugLicenseNumber: true } },
            retailer: { select: { storeName: true, gstNumber: true, addressLine1: true, city: true, state: true, pincode: true, drugLicenseNumber: true } },
        },
    });
    if (!invoice)
        throw ApiError_1.ApiError.notFound('Invoice not found');
    return invoice;
}
async function listPayments(scope, query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const { from, to } = dateWindow(query);
    const where = {
        ...ownerWhere(scope),
        paidAt: { gte: from, lte: to },
        ...(query.direction ? { direction: query.direction } : {}),
        ...(query.mode ? { mode: query.mode } : {}),
    };
    const [items, total, totals] = await Promise.all([
        prisma_1.prisma.payment.findMany({
            where,
            include: {
                purchaseOrder: { select: { poNumber: true } },
                order: { select: { orderNumber: true } },
            },
            orderBy: { paidAt: 'desc' },
            skip,
            take,
        }),
        prisma_1.prisma.payment.count({ where }),
        prisma_1.prisma.payment.groupBy({ by: ['direction'], where, _sum: { amount: true } }),
    ]);
    return {
        items,
        meta: (0, response_1.buildMeta)(page, limit, total),
        totals: {
            received: (0, money_1.toNumber)(totals.find((row) => row.direction === 'IN')?._sum.amount ?? 0),
            paid: (0, money_1.toNumber)(totals.find((row) => row.direction === 'OUT')?._sum.amount ?? 0),
        },
    };
}
/** Standalone payment entry (counter collection, advance, ad-hoc settlement). */
async function recordPayment(scope, data) {
    return prisma_1.prisma.$transaction(async (tx) => {
        const paymentNumber = await (0, numbering_1.nextDocumentNumber)(tx, 'payment');
        const payment = await tx.payment.create({
            data: {
                paymentNumber,
                ownerType: scope.ownerType,
                vendorId: scope.vendorId ?? null,
                retailerId: scope.retailerId ?? null,
                direction: data.direction,
                mode: data.mode,
                amount: (0, money_1.D)(data.amount),
                status: 'PAID',
                referenceNo: data.referenceNo ?? null,
                paidAt: data.paidAt ?? new Date(),
                notes: data.notes ?? null,
            },
        });
        await tx.financeTransaction.create({
            data: {
                ownerType: scope.ownerType,
                vendorId: scope.vendorId ?? null,
                retailerId: scope.retailerId ?? null,
                type: data.direction === 'IN' ? 'PAYMENT_IN' : 'PAYMENT_OUT',
                direction: data.direction,
                amount: payment.amount,
                referenceType: 'PAYMENT',
                referenceId: payment.id,
                partyName: data.partyName ?? null,
                description: data.notes ?? 'Manual payment entry',
                txnDate: payment.paidAt,
            },
        });
        return payment;
    });
}
// ---------------------------------------------------------------------------
// GST
// ---------------------------------------------------------------------------
async function gstReport(scope, query) {
    const { from, to } = dateWindow(query);
    const outward = await prisma_1.prisma.$queryRaw `
    SELECT COALESCE(SUM(taxableAmount), 0) AS taxable,
           COALESCE(SUM(cgstAmount), 0) AS cgst,
           COALESCE(SUM(sgstAmount), 0) AS sgst,
           COALESCE(SUM(igstAmount), 0) AS igst,
           COALESCE(SUM(totalAmount), 0) AS total,
           COUNT(*) AS count
    FROM invoices
    WHERE ${ownerSql(scope)} AND type = 'SALES' AND invoiceDate BETWEEN ${from} AND ${to}`;
    const inward = await prisma_1.prisma.$queryRaw `
    SELECT COALESCE(SUM(po.taxableAmount), 0) AS taxable,
           COALESCE(SUM(po.cgstAmount), 0) AS cgst,
           COALESCE(SUM(po.sgstAmount), 0) AS sgst,
           COALESCE(SUM(po.igstAmount), 0) AS igst,
           COALESCE(SUM(po.totalAmount), 0) AS total,
           COUNT(*) AS count
    FROM purchase_orders po
    WHERE po.${scope.ownerType === 'VENDOR' ? client_1.Prisma.raw('vendorId') : client_1.Prisma.raw('retailerId')} = ${scope.ownerType === 'VENDOR' ? scope.vendorId : scope.retailerId}
      AND po.status IN ('RECEIVED','COMPLETED','DELIVERED')
      AND po.createdAt BETWEEN ${from} AND ${to}`;
    const rateWise = await prisma_1.prisma.$queryRaw `
    SELECT oi.gstRate AS gstRate,
           COALESCE(SUM(oi.taxableAmount), 0) AS taxable,
           COALESCE(SUM(oi.taxAmount), 0) AS tax
    FROM order_items oi
    JOIN orders o ON o.id = oi.orderId
    WHERE o.retailerId = ${scope.retailerId ?? ''}
      AND o.status IN ('PICKED_UP','COMPLETED')
      AND o.createdAt BETWEEN ${from} AND ${to}
    GROUP BY oi.gstRate ORDER BY oi.gstRate ASC`;
    const shape = (row) => ({
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
        netPayable: (0, money_1.round2)(outwardTotals.totalTax - inwardTotals.totalTax).toNumber(),
        rateWise: rateWise.map((row) => ({
            gstRate: Number(row.gstRate),
            taxableAmount: Number(row.taxable),
            taxAmount: Number(row.tax),
        })),
    };
}
//# sourceMappingURL=finance.service.js.map
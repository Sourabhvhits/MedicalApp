"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORT_COLUMNS = void 0;
exports.describeFilters = describeFilters;
exports.salesReport = salesReport;
exports.salesByProduct = salesByProduct;
exports.purchaseReport = purchaseReport;
exports.stockReport = stockReport;
exports.stockMovementReport = stockMovementReport;
exports.lowStockReport = lowStockReport;
exports.expiryReport = expiryReport;
exports.expirySummaryReport = expirySummaryReport;
exports.orderReport = orderReport;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../database/prisma");
const money_1 = require("../../utils/money");
const time_1 = require("../../utils/time");
const constants_1 = require("../../config/constants");
function window(filters) {
    return {
        from: filters.dateFrom ? (0, time_1.startOfDay)(filters.dateFrom) : (0, time_1.startOfDay)((0, time_1.dayjs)().subtract(29, 'day').toDate()),
        to: filters.dateTo ? (0, time_1.endOfDay)(filters.dateTo) : (0, time_1.endOfDay)(),
    };
}
/** Describes the applied filters so exports can state them in the header. */
function describeFilters(filters) {
    const { from, to } = window(filters);
    const parts = [`Period: ${(0, time_1.dayjs)(from).format('DD-MM-YYYY')} to ${(0, time_1.dayjs)(to).format('DD-MM-YYYY')}`];
    if (filters.status)
        parts.push(`Status: ${filters.status}`);
    if (filters.categoryId)
        parts.push(`Category: ${filters.categoryId}`);
    if (filters.productId)
        parts.push(`Product: ${filters.productId}`);
    return parts.join('   |   ');
}
// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------
async function salesReport(scope, filters) {
    const { from, to } = window(filters);
    const where = {
        createdAt: { gte: from, lte: to },
        ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
        ...(filters.retailerId && !scope.retailerId ? { retailerId: filters.retailerId } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        status: filters.status
            ? filters.status
            : { in: ['PICKED_UP', 'COMPLETED'] },
        ...(filters.productId || filters.categoryId
            ? {
                items: {
                    some: {
                        ...(filters.productId ? { productId: filters.productId } : {}),
                        ...(filters.categoryId ? { product: { categoryId: filters.categoryId } } : {}),
                    },
                },
            }
            : {}),
    };
    const orders = await prisma_1.prisma.order.findMany({
        where,
        select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            status: true,
            subtotal: true,
            discountAmount: true,
            taxableAmount: true,
            taxAmount: true,
            totalAmount: true,
            paymentMode: true,
            retailer: { select: { storeName: true } },
            customer: { select: { user: { select: { firstName: true, lastName: true, phone: true } } } },
            _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 5000,
    });
    const rows = orders.map((order) => ({
        orderNumber: order.orderNumber,
        date: (0, time_1.dayjs)(order.createdAt).format('DD-MM-YYYY HH:mm'),
        store: order.retailer.storeName,
        customer: `${order.customer.user.firstName} ${order.customer.user.lastName ?? ''}`.trim(),
        phone: order.customer.user.phone,
        items: order._count.items,
        status: order.status,
        paymentMode: order.paymentMode,
        subtotal: (0, money_1.toNumber)(order.subtotal),
        discount: (0, money_1.toNumber)(order.discountAmount),
        taxable: (0, money_1.toNumber)(order.taxableAmount),
        tax: (0, money_1.toNumber)(order.taxAmount),
        total: (0, money_1.toNumber)(order.totalAmount),
    }));
    const totals = rows.reduce((acc, row) => ({
        subtotal: acc.subtotal + row.subtotal,
        discount: acc.discount + row.discount,
        taxable: acc.taxable + row.taxable,
        tax: acc.tax + row.tax,
        total: acc.total + row.total,
    }), { subtotal: 0, discount: 0, taxable: 0, tax: 0, total: 0 });
    return { rows, totals: { ...totals, orders: rows.length } };
}
async function salesByProduct(scope, filters) {
    const { from, to } = window(filters);
    const retailerId = scope.retailerId ?? filters.retailerId;
    const rows = await prisma_1.prisma.$queryRaw `
    SELECT p.id AS productId, p.name, p.sku, c.name AS category,
           COALESCE(SUM(oi.quantity), 0) AS qty,
           COALESCE(SUM(oi.totalAmount), 0) AS revenue,
           COALESCE(SUM(oi.taxAmount), 0) AS tax
    FROM order_items oi
    JOIN orders o ON o.id = oi.orderId
    JOIN products p ON p.id = oi.productId
    JOIN categories c ON c.id = p.categoryId
    WHERE o.createdAt BETWEEN ${from} AND ${to}
      AND o.status IN ('PICKED_UP','COMPLETED')
      ${retailerId ? client_1.Prisma.sql `AND o.retailerId = ${retailerId}` : client_1.Prisma.empty}
      ${filters.categoryId ? client_1.Prisma.sql `AND p.categoryId = ${filters.categoryId}` : client_1.Prisma.empty}
    GROUP BY p.id, p.name, p.sku, c.name
    ORDER BY revenue DESC
    LIMIT ${filters.limit ?? 500}`;
    return {
        rows: rows.map((row) => ({
            product: row.name,
            sku: row.sku,
            category: row.category,
            quantity: Number(row.qty),
            revenue: Number(row.revenue),
            tax: Number(row.tax),
        })),
        totals: {
            quantity: rows.reduce((sum, row) => sum + Number(row.qty), 0),
            revenue: rows.reduce((sum, row) => sum + Number(row.revenue), 0),
            tax: rows.reduce((sum, row) => sum + Number(row.tax), 0),
        },
    };
}
// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------
async function purchaseReport(scope, filters) {
    const { from, to } = window(filters);
    const where = {
        createdAt: { gte: from, lte: to },
        ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
        ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
        ...(filters.vendorId && !scope.vendorId ? { vendorId: filters.vendorId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.productId || filters.categoryId
            ? {
                items: {
                    some: {
                        ...(filters.productId ? { productId: filters.productId } : {}),
                        ...(filters.categoryId ? { product: { categoryId: filters.categoryId } } : {}),
                    },
                },
            }
            : {}),
    };
    const orders = await prisma_1.prisma.purchaseOrder.findMany({
        where,
        select: {
            poNumber: true,
            createdAt: true,
            status: true,
            paymentStatus: true,
            subtotal: true,
            discountAmount: true,
            taxableAmount: true,
            taxAmount: true,
            totalAmount: true,
            paidAmount: true,
            vendor: { select: { businessName: true } },
            retailer: { select: { storeName: true } },
            _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 5000,
    });
    const rows = orders.map((order) => ({
        poNumber: order.poNumber,
        date: (0, time_1.dayjs)(order.createdAt).format('DD-MM-YYYY'),
        vendor: order.vendor.businessName,
        store: order.retailer.storeName,
        items: order._count.items,
        status: order.status,
        paymentStatus: order.paymentStatus,
        taxable: (0, money_1.toNumber)(order.taxableAmount),
        tax: (0, money_1.toNumber)(order.taxAmount),
        total: (0, money_1.toNumber)(order.totalAmount),
        paid: (0, money_1.toNumber)(order.paidAmount),
        outstanding: (0, money_1.toNumber)(order.totalAmount) - (0, money_1.toNumber)(order.paidAmount),
    }));
    return {
        rows,
        totals: {
            orders: rows.length,
            taxable: rows.reduce((sum, row) => sum + row.taxable, 0),
            tax: rows.reduce((sum, row) => sum + row.tax, 0),
            total: rows.reduce((sum, row) => sum + row.total, 0),
            paid: rows.reduce((sum, row) => sum + row.paid, 0),
            outstanding: rows.reduce((sum, row) => sum + row.outstanding, 0),
        },
    };
}
// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------
function ownerBatchFilter(scope) {
    if (scope.vendorId)
        return client_1.Prisma.sql `AND b.vendorId = ${scope.vendorId}`;
    if (scope.retailerId)
        return client_1.Prisma.sql `AND b.retailerId = ${scope.retailerId}`;
    return client_1.Prisma.empty;
}
async function stockReport(scope, filters) {
    const rows = await prisma_1.prisma.$queryRaw `
    SELECT p.name, p.sku, c.name AS category, b.batchNumber, b.expiryDate,
           b.quantity, b.freeQuantity, b.reservedQty, b.purchasePrice, b.mrp,
           COALESCE(s.storeName, v.businessName, '') AS owner
    FROM inventory_batches b
    JOIN products p ON p.id = b.productId
    JOIN categories c ON c.id = p.categoryId
    LEFT JOIN medical_shops s ON s.id = b.retailerId
    LEFT JOIN medical_vendors v ON v.id = b.vendorId
    WHERE b.quantity + b.freeQuantity > 0
      ${ownerBatchFilter(scope)}
      ${filters.categoryId ? client_1.Prisma.sql `AND p.categoryId = ${filters.categoryId}` : client_1.Prisma.empty}
      ${filters.productId ? client_1.Prisma.sql `AND b.productId = ${filters.productId}` : client_1.Prisma.empty}
    ORDER BY p.name ASC, b.expiryDate ASC
    LIMIT ${filters.limit ?? 5000}`;
    const mapped = rows.map((row) => ({
        product: row.name,
        sku: row.sku,
        category: row.category,
        owner: row.owner,
        batchNumber: row.batchNumber,
        expiryDate: (0, time_1.dayjs)(row.expiryDate).format('DD-MM-YYYY'),
        daysToExpiry: (0, time_1.dayjs)(row.expiryDate).startOf('day').diff((0, time_1.dayjs)().startOf('day'), 'day'),
        quantity: row.quantity + row.freeQuantity,
        reserved: row.reservedQty,
        available: row.quantity + row.freeQuantity - row.reservedQty,
        purchasePrice: Number(row.purchasePrice),
        mrp: Number(row.mrp),
        stockValue: Number(row.purchasePrice) * (row.quantity + row.freeQuantity),
    }));
    return {
        rows: mapped,
        totals: {
            batches: mapped.length,
            quantity: mapped.reduce((sum, row) => sum + row.quantity, 0),
            stockValue: mapped.reduce((sum, row) => sum + row.stockValue, 0),
        },
    };
}
async function stockMovementReport(scope, filters) {
    const { from, to } = window(filters);
    const where = {
        createdAt: { gte: from, lte: to },
        ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
        ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
        ...(filters.productId ? { productId: filters.productId } : {}),
    };
    const transactions = await prisma_1.prisma.inventoryTransaction.findMany({
        where,
        select: {
            createdAt: true,
            type: true,
            direction: true,
            quantity: true,
            balanceAfter: true,
            unitCost: true,
            referenceType: true,
            notes: true,
            product: { select: { name: true, sku: true } },
            batch: { select: { batchNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 5000,
    });
    return {
        rows: transactions.map((txn) => ({
            date: (0, time_1.dayjs)(txn.createdAt).format('DD-MM-YYYY HH:mm'),
            product: txn.product.name,
            sku: txn.product.sku,
            batch: txn.batch?.batchNumber ?? '',
            type: txn.type,
            direction: txn.direction,
            quantity: txn.quantity,
            balanceAfter: txn.balanceAfter ?? '',
            unitCost: (0, money_1.toNumber)(txn.unitCost ?? 0),
            reference: txn.referenceType ?? '',
            notes: txn.notes ?? '',
        })),
        totals: {
            transactions: transactions.length,
            inQty: transactions.filter((t) => t.direction === 'IN').reduce((sum, t) => sum + t.quantity, 0),
            outQty: transactions.filter((t) => t.direction === 'OUT').reduce((sum, t) => sum + t.quantity, 0),
        },
    };
}
async function lowStockReport(scope) {
    const ownerFilter = scope.vendorId
        ? client_1.Prisma.sql `AND w.vendorId = ${scope.vendorId}`
        : scope.retailerId
            ? client_1.Prisma.sql `AND w.retailerId = ${scope.retailerId}`
            : client_1.Prisma.empty;
    const rows = await prisma_1.prisma.$queryRaw `
    SELECT p.name, p.sku, c.name AS category, i.availableQty, i.minStockAlert,
           COALESCE(s.storeName, v.businessName, '') AS owner
    FROM inventory i
    JOIN warehouses w ON w.id = i.warehouseId
    JOIN products p ON p.id = i.productId
    JOIN categories c ON c.id = p.categoryId
    LEFT JOIN medical_shops s ON s.id = w.retailerId
    LEFT JOIN medical_vendors v ON v.id = w.vendorId
    WHERE i.availableQty <= i.minStockAlert
      ${ownerFilter}
    ORDER BY i.availableQty ASC
    LIMIT 1000`;
    return {
        rows: rows.map((row) => ({
            product: row.name,
            sku: row.sku,
            category: row.category,
            owner: row.owner,
            available: row.availableQty,
            minimum: row.minStockAlert,
            shortfall: Math.max(0, row.minStockAlert - row.availableQty),
            status: row.availableQty === 0 ? 'OUT OF STOCK' : 'LOW STOCK',
        })),
        totals: { products: rows.length },
    };
}
// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------
async function expiryReport(scope, filters) {
    const days = filters.days ?? 90;
    const expired = days === 0;
    const rows = await prisma_1.prisma.$queryRaw `
    SELECT p.name, p.sku, c.name AS category, b.batchNumber, b.expiryDate,
           b.quantity, b.freeQuantity, b.purchasePrice, b.mrp,
           COALESCE(s.storeName, v.businessName, '') AS owner
    FROM inventory_batches b
    JOIN products p ON p.id = b.productId
    JOIN categories c ON c.id = p.categoryId
    LEFT JOIN medical_shops s ON s.id = b.retailerId
    LEFT JOIN medical_vendors v ON v.id = b.vendorId
    WHERE b.quantity + b.freeQuantity > 0
      ${expired
        ? client_1.Prisma.sql `AND b.expiryDate <= CURDATE()`
        : client_1.Prisma.sql `AND b.expiryDate > CURDATE() AND b.expiryDate <= DATE_ADD(CURDATE(), INTERVAL ${days} DAY)`}
      ${ownerBatchFilter(scope)}
      ${filters.categoryId ? client_1.Prisma.sql `AND p.categoryId = ${filters.categoryId}` : client_1.Prisma.empty}
    ORDER BY b.expiryDate ASC
    LIMIT ${filters.limit ?? 5000}`;
    const mapped = rows.map((row) => ({
        product: row.name,
        sku: row.sku,
        category: row.category,
        owner: row.owner,
        batchNumber: row.batchNumber,
        expiryDate: (0, time_1.dayjs)(row.expiryDate).format('DD-MM-YYYY'),
        daysToExpiry: (0, time_1.dayjs)(row.expiryDate).startOf('day').diff((0, time_1.dayjs)().startOf('day'), 'day'),
        quantity: row.quantity + row.freeQuantity,
        purchasePrice: Number(row.purchasePrice),
        mrp: Number(row.mrp),
        valueAtRisk: Number(row.purchasePrice) * (row.quantity + row.freeQuantity),
    }));
    return {
        rows: mapped,
        totals: {
            batches: mapped.length,
            quantity: mapped.reduce((sum, row) => sum + row.quantity, 0),
            valueAtRisk: mapped.reduce((sum, row) => sum + row.valueAtRisk, 0),
        },
    };
}
async function expirySummaryReport(scope) {
    const buckets = await Promise.all(constants_1.EXPIRY_BUCKETS.map(async (days) => {
        const report = await expiryReport(scope, { days });
        return { days, ...report.totals };
    }));
    const expired = await expiryReport(scope, { days: 0 });
    return {
        expired: expired.totals,
        buckets,
    };
}
// ---------------------------------------------------------------------------
// Orders (admin)
// ---------------------------------------------------------------------------
async function orderReport(scope, filters) {
    const { from, to } = window(filters);
    const [byStatus, byStore, byDay, purchaseByStatus] = await Promise.all([
        prisma_1.prisma.order.groupBy({
            by: ['status'],
            where: {
                createdAt: { gte: from, lte: to },
                ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
                ...(filters.retailerId ? { retailerId: filters.retailerId } : {}),
            },
            _count: { _all: true },
            _sum: { totalAmount: true },
        }),
        prisma_1.prisma.$queryRaw `
      SELECT s.storeName, COUNT(o.id) AS orders, COALESCE(SUM(o.totalAmount), 0) AS total
      FROM orders o JOIN medical_shops s ON s.id = o.retailerId
      WHERE o.createdAt BETWEEN ${from} AND ${to}
      GROUP BY s.storeName ORDER BY total DESC LIMIT 100`,
        prisma_1.prisma.$queryRaw `
      SELECT DATE(createdAt) AS day, COUNT(*) AS orders, COALESCE(SUM(totalAmount), 0) AS total
      FROM orders WHERE createdAt BETWEEN ${from} AND ${to}
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
        prisma_1.prisma.purchaseOrder.groupBy({
            by: ['status'],
            where: {
                createdAt: { gte: from, lte: to },
                ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
                ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
            },
            _count: { _all: true },
            _sum: { totalAmount: true },
        }),
    ]);
    return {
        customerOrders: byStatus.map((row) => ({
            status: row.status,
            count: row._count._all,
            amount: (0, money_1.toNumber)(row._sum.totalAmount ?? 0),
        })),
        vendorOrders: purchaseByStatus.map((row) => ({
            status: row.status,
            count: row._count._all,
            amount: (0, money_1.toNumber)(row._sum.totalAmount ?? 0),
        })),
        byStore: byStore.map((row) => ({
            store: row.storeName,
            orders: Number(row.orders),
            amount: Number(row.total),
        })),
        byDay: byDay.map((row) => ({
            day: (0, time_1.dayjs)(row.day).format('YYYY-MM-DD'),
            orders: Number(row.orders),
            amount: Number(row.total),
        })),
    };
}
// ---------------------------------------------------------------------------
// Column definitions shared by the API and the exporters
// ---------------------------------------------------------------------------
exports.REPORT_COLUMNS = {
    sales: [
        { key: 'orderNumber', header: 'Order No', width: 18 },
        { key: 'date', header: 'Date', width: 16 },
        { key: 'store', header: 'Store', width: 22 },
        { key: 'customer', header: 'Customer', width: 20 },
        { key: 'phone', header: 'Phone', width: 14 },
        { key: 'items', header: 'Items', width: 8, numeric: true },
        { key: 'status', header: 'Status', width: 14 },
        { key: 'taxable', header: 'Taxable', width: 12, numeric: true },
        { key: 'tax', header: 'GST', width: 10, numeric: true },
        { key: 'total', header: 'Total', width: 12, numeric: true },
    ],
    salesByProduct: [
        { key: 'product', header: 'Product', width: 30 },
        { key: 'sku', header: 'SKU', width: 16 },
        { key: 'category', header: 'Category', width: 18 },
        { key: 'quantity', header: 'Qty Sold', width: 12, numeric: true },
        { key: 'revenue', header: 'Revenue', width: 14, numeric: true },
        { key: 'tax', header: 'GST', width: 12, numeric: true },
    ],
    purchase: [
        { key: 'poNumber', header: 'PO No', width: 18 },
        { key: 'date', header: 'Date', width: 14 },
        { key: 'vendor', header: 'Vendor', width: 24 },
        { key: 'store', header: 'Store', width: 22 },
        { key: 'status', header: 'Status', width: 14 },
        { key: 'taxable', header: 'Taxable', width: 12, numeric: true },
        { key: 'tax', header: 'GST', width: 10, numeric: true },
        { key: 'total', header: 'Total', width: 12, numeric: true },
        { key: 'paid', header: 'Paid', width: 12, numeric: true },
        { key: 'outstanding', header: 'Outstanding', width: 14, numeric: true },
    ],
    stock: [
        { key: 'product', header: 'Product', width: 28 },
        { key: 'sku', header: 'SKU', width: 14 },
        { key: 'category', header: 'Category', width: 16 },
        { key: 'batchNumber', header: 'Batch', width: 14 },
        { key: 'expiryDate', header: 'Expiry', width: 12 },
        { key: 'daysToExpiry', header: 'Days Left', width: 10, numeric: true },
        { key: 'quantity', header: 'Qty', width: 9, numeric: true },
        { key: 'reserved', header: 'Reserved', width: 10, numeric: true },
        { key: 'available', header: 'Available', width: 10, numeric: true },
        { key: 'purchasePrice', header: 'Cost', width: 11, numeric: true },
        { key: 'mrp', header: 'MRP', width: 11, numeric: true },
        { key: 'stockValue', header: 'Stock Value', width: 14, numeric: true },
    ],
    stockMovement: [
        { key: 'date', header: 'Date', width: 16 },
        { key: 'product', header: 'Product', width: 26 },
        { key: 'batch', header: 'Batch', width: 14 },
        { key: 'type', header: 'Type', width: 16 },
        { key: 'direction', header: 'Dir', width: 8 },
        { key: 'quantity', header: 'Qty', width: 9, numeric: true },
        { key: 'balanceAfter', header: 'Balance', width: 10, numeric: true },
        { key: 'unitCost', header: 'Unit Cost', width: 12, numeric: true },
        { key: 'reference', header: 'Reference', width: 16 },
    ],
    lowStock: [
        { key: 'product', header: 'Product', width: 30 },
        { key: 'sku', header: 'SKU', width: 16 },
        { key: 'category', header: 'Category', width: 18 },
        { key: 'available', header: 'Available', width: 12, numeric: true },
        { key: 'minimum', header: 'Minimum', width: 12, numeric: true },
        { key: 'shortfall', header: 'Shortfall', width: 12, numeric: true },
        { key: 'status', header: 'Status', width: 16 },
    ],
    expiry: [
        { key: 'product', header: 'Product', width: 28 },
        { key: 'sku', header: 'SKU', width: 14 },
        { key: 'category', header: 'Category', width: 16 },
        { key: 'batchNumber', header: 'Batch', width: 14 },
        { key: 'expiryDate', header: 'Expiry', width: 12 },
        { key: 'daysToExpiry', header: 'Days Left', width: 10, numeric: true },
        { key: 'quantity', header: 'Qty', width: 10, numeric: true },
        { key: 'purchasePrice', header: 'Cost', width: 12, numeric: true },
        { key: 'valueAtRisk', header: 'Value at Risk', width: 14, numeric: true },
    ],
};
//# sourceMappingURL=report.service.js.map
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { toNumber } from '../../utils/money';
import { dayjs, endOfDay, startOfDay } from '../../utils/time';
import { EXPIRY_BUCKETS } from '../../config/constants';

export interface ReportScope {
  ownerType: 'VENDOR' | 'RETAILER' | 'ADMIN';
  vendorId?: string;
  retailerId?: string;
}

export interface ReportFilters {
  dateFrom?: Date;
  dateTo?: Date;
  retailerId?: string;
  vendorId?: string;
  productId?: string;
  categoryId?: string;
  customerId?: string;
  status?: string;
  limit?: number;
}

function window(filters: ReportFilters) {
  return {
    from: filters.dateFrom ? startOfDay(filters.dateFrom) : startOfDay(dayjs().subtract(29, 'day').toDate()),
    to: filters.dateTo ? endOfDay(filters.dateTo) : endOfDay(),
  };
}

/** Describes the applied filters so exports can state them in the header. */
export function describeFilters(filters: ReportFilters): string {
  const { from, to } = window(filters);
  const parts = [`Period: ${dayjs(from).format('DD-MM-YYYY')} to ${dayjs(to).format('DD-MM-YYYY')}`];
  if (filters.status) parts.push(`Status: ${filters.status}`);
  if (filters.categoryId) parts.push(`Category: ${filters.categoryId}`);
  if (filters.productId) parts.push(`Product: ${filters.productId}`);
  return parts.join('   |   ');
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export async function salesReport(scope: ReportScope, filters: ReportFilters) {
  const { from, to } = window(filters);

  const where: Prisma.OrderWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
    ...(filters.retailerId && !scope.retailerId ? { retailerId: filters.retailerId } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    status: filters.status
      ? (filters.status as never)
      : { in: ['PICKED_UP', 'DELIVERED', 'COMPLETED'] },
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

  const orders = await prisma.order.findMany({
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
    date: dayjs(order.createdAt).format('DD-MM-YYYY HH:mm'),
    store: order.retailer.storeName,
    customer: `${order.customer.user.firstName} ${order.customer.user.lastName ?? ''}`.trim(),
    phone: order.customer.user.phone,
    items: order._count.items,
    status: order.status,
    paymentMode: order.paymentMode,
    subtotal: toNumber(order.subtotal),
    discount: toNumber(order.discountAmount),
    taxable: toNumber(order.taxableAmount),
    tax: toNumber(order.taxAmount),
    total: toNumber(order.totalAmount),
  }));

  const totals = rows.reduce(
    (acc, row) => ({
      subtotal: acc.subtotal + row.subtotal,
      discount: acc.discount + row.discount,
      taxable: acc.taxable + row.taxable,
      tax: acc.tax + row.tax,
      total: acc.total + row.total,
    }),
    { subtotal: 0, discount: 0, taxable: 0, tax: 0, total: 0 },
  );

  return { rows, totals: { ...totals, orders: rows.length } };
}

export async function salesByProduct(scope: ReportScope, filters: ReportFilters) {
  const { from, to } = window(filters);
  const retailerId = scope.retailerId ?? filters.retailerId;

  const rows = await prisma.$queryRaw<
    { productId: string; name: string; sku: string; category: string; qty: string; revenue: string; tax: string }[]
  >`
    SELECT p.id AS productId, p.name, p.sku, c.name AS category,
           COALESCE(SUM(oi.quantity), 0) AS qty,
           COALESCE(SUM(oi.totalAmount), 0) AS revenue,
           COALESCE(SUM(oi.taxAmount), 0) AS tax
    FROM order_items oi
    JOIN orders o ON o.id = oi.orderId
    JOIN products p ON p.id = oi.productId
    JOIN categories c ON c.id = p.categoryId
    WHERE o.createdAt BETWEEN ${from} AND ${to}
      AND o.status IN ('PICKED_UP','DELIVERED','COMPLETED')
      ${retailerId ? Prisma.sql`AND o.retailerId = ${retailerId}` : Prisma.empty}
      ${filters.categoryId ? Prisma.sql`AND p.categoryId = ${filters.categoryId}` : Prisma.empty}
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

export async function purchaseReport(scope: ReportScope, filters: ReportFilters) {
  const { from, to } = window(filters);

  const where: Prisma.PurchaseOrderWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
    ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
    ...(filters.vendorId && !scope.vendorId ? { vendorId: filters.vendorId } : {}),
    ...(filters.status ? { status: filters.status as never } : {}),
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

  const orders = await prisma.purchaseOrder.findMany({
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
    date: dayjs(order.createdAt).format('DD-MM-YYYY'),
    vendor: order.vendor.businessName,
    store: order.retailer.storeName,
    items: order._count.items,
    status: order.status,
    paymentStatus: order.paymentStatus,
    taxable: toNumber(order.taxableAmount),
    tax: toNumber(order.taxAmount),
    total: toNumber(order.totalAmount),
    paid: toNumber(order.paidAmount),
    outstanding: toNumber(order.totalAmount) - toNumber(order.paidAmount),
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

function ownerBatchFilter(scope: ReportScope): Prisma.Sql {
  if (scope.vendorId) return Prisma.sql`AND b.vendorId = ${scope.vendorId}`;
  if (scope.retailerId) return Prisma.sql`AND b.retailerId = ${scope.retailerId}`;
  return Prisma.empty;
}

export async function stockReport(scope: ReportScope, filters: ReportFilters) {
  const rows = await prisma.$queryRaw<
    {
      name: string;
      sku: string;
      category: string;
      batchNumber: string;
      expiryDate: Date;
      quantity: number;
      freeQuantity: number;
      reservedQty: number;
      purchasePrice: string;
      mrp: string;
      owner: string;
    }[]
  >`
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
      ${filters.categoryId ? Prisma.sql`AND p.categoryId = ${filters.categoryId}` : Prisma.empty}
      ${filters.productId ? Prisma.sql`AND b.productId = ${filters.productId}` : Prisma.empty}
    ORDER BY p.name ASC, b.expiryDate ASC
    LIMIT ${filters.limit ?? 5000}`;

  const mapped = rows.map((row) => ({
    product: row.name,
    sku: row.sku,
    category: row.category,
    owner: row.owner,
    batchNumber: row.batchNumber,
    expiryDate: dayjs(row.expiryDate).format('DD-MM-YYYY'),
    daysToExpiry: dayjs(row.expiryDate).startOf('day').diff(dayjs().startOf('day'), 'day'),
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

export async function stockMovementReport(scope: ReportScope, filters: ReportFilters) {
  const { from, to } = window(filters);

  const where: Prisma.InventoryTransactionWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
    ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
    ...(filters.productId ? { productId: filters.productId } : {}),
  };

  const transactions = await prisma.inventoryTransaction.findMany({
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
      date: dayjs(txn.createdAt).format('DD-MM-YYYY HH:mm'),
      product: txn.product.name,
      sku: txn.product.sku,
      batch: txn.batch?.batchNumber ?? '',
      type: txn.type,
      direction: txn.direction,
      quantity: txn.quantity,
      balanceAfter: txn.balanceAfter ?? '',
      unitCost: toNumber(txn.unitCost ?? 0),
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

export async function lowStockReport(scope: ReportScope) {
  const ownerFilter = scope.vendorId
    ? Prisma.sql`AND w.vendorId = ${scope.vendorId}`
    : scope.retailerId
      ? Prisma.sql`AND w.retailerId = ${scope.retailerId}`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<
    { name: string; sku: string; category: string; availableQty: number; minStockAlert: number; owner: string }[]
  >`
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

export async function expiryReport(scope: ReportScope, filters: ReportFilters & { days?: number }) {
  const days = filters.days ?? 90;
  const expired = days === 0;

  const rows = await prisma.$queryRaw<
    {
      name: string;
      sku: string;
      category: string;
      batchNumber: string;
      expiryDate: Date;
      quantity: number;
      freeQuantity: number;
      purchasePrice: string;
      mrp: string;
      owner: string;
    }[]
  >`
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
        ? Prisma.sql`AND b.expiryDate <= CURDATE()`
        : Prisma.sql`AND b.expiryDate > CURDATE() AND b.expiryDate <= DATE_ADD(CURDATE(), INTERVAL ${days} DAY)`}
      ${ownerBatchFilter(scope)}
      ${filters.categoryId ? Prisma.sql`AND p.categoryId = ${filters.categoryId}` : Prisma.empty}
    ORDER BY b.expiryDate ASC
    LIMIT ${filters.limit ?? 5000}`;

  const mapped = rows.map((row) => ({
    product: row.name,
    sku: row.sku,
    category: row.category,
    owner: row.owner,
    batchNumber: row.batchNumber,
    expiryDate: dayjs(row.expiryDate).format('DD-MM-YYYY'),
    daysToExpiry: dayjs(row.expiryDate).startOf('day').diff(dayjs().startOf('day'), 'day'),
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

export async function expirySummaryReport(scope: ReportScope) {
  const buckets = await Promise.all(
    EXPIRY_BUCKETS.map(async (days) => {
      const report = await expiryReport(scope, { days });
      return { days, ...report.totals };
    }),
  );
  const expired = await expiryReport(scope, { days: 0 });

  return {
    expired: expired.totals,
    buckets,
  };
}

// ---------------------------------------------------------------------------
// Orders (admin)
// ---------------------------------------------------------------------------

export async function orderReport(scope: ReportScope, filters: ReportFilters) {
  const { from, to } = window(filters);

  const [byStatus, byStore, byDay, purchaseByStatus] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: from, lte: to },
        ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
        ...(filters.retailerId ? { retailerId: filters.retailerId } : {}),
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.$queryRaw<{ storeName: string; orders: bigint; total: string }[]>`
      SELECT s.storeName, COUNT(o.id) AS orders, COALESCE(SUM(o.totalAmount), 0) AS total
      FROM orders o JOIN medical_shops s ON s.id = o.retailerId
      WHERE o.createdAt BETWEEN ${from} AND ${to}
      GROUP BY s.storeName ORDER BY total DESC LIMIT 100`,
    prisma.$queryRaw<{ day: string; orders: bigint; total: string }[]>`
      SELECT DATE(createdAt) AS day, COUNT(*) AS orders, COALESCE(SUM(totalAmount), 0) AS total
      FROM orders WHERE createdAt BETWEEN ${from} AND ${to}
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
    prisma.purchaseOrder.groupBy({
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
      amount: toNumber(row._sum.totalAmount ?? 0),
    })),
    vendorOrders: purchaseByStatus.map((row) => ({
      status: row.status,
      count: row._count._all,
      amount: toNumber(row._sum.totalAmount ?? 0),
    })),
    byStore: byStore.map((row) => ({
      store: row.storeName,
      orders: Number(row.orders),
      amount: Number(row.total),
    })),
    byDay: byDay.map((row) => ({
      day: dayjs(row.day).format('YYYY-MM-DD'),
      orders: Number(row.orders),
      amount: Number(row.total),
    })),
  };
}

// ---------------------------------------------------------------------------
// Column definitions shared by the API and the exporters
// ---------------------------------------------------------------------------

export const REPORT_COLUMNS = {
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
} as const;

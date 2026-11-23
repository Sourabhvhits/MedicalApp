import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { buildMeta } from '../../utils/response';
import { getPagination } from '../../utils/pagination';
import { toNumber } from '../../utils/money';
import { dayjs, endOfDay, startOfDay } from '../../utils/time';
import { recordPriceChanges } from '../../common/price-history';
import { publicUrl } from '../../middleware/upload';
import { toSignedUrl } from '../../lib/signed-url';
import type { ExportColumn } from '../../utils/export';
import type { ImportResult } from '../../utils/csv-import';
import { runImport } from '../../utils/csv-import';
import { vendorCatalogImportRowSchema } from './vendor.validation';

export async function getProfile(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      documents: { orderBy: { createdAt: 'desc' } },
      warehouses: { orderBy: { isDefault: 'desc' } },
    },
  });
  if (!vendor) throw ApiError.notFound('Vendor profile not found');
  return {
    ...vendor,
    documents: vendor.documents.map((doc) => ({ ...doc, fileUrl: toSignedUrl(doc.fileUrl) ?? doc.fileUrl })),
  };
}

export async function updateProfile(vendorId: string, data: Record<string, unknown>) {
  const vendor = await getProfile(vendorId);

  // Re-verification is required when statutory identifiers change.
  const identityChanged =
    (data.gstNumber && data.gstNumber !== vendor.gstNumber) ||
    (data.drugLicenseNumber && data.drugLicenseNumber !== vendor.drugLicenseNumber);

  return prisma.vendor.update({
    where: { id: vendorId },
    data: {
      ...data,
      ...(identityChanged && vendor.approvalStatus === 'APPROVED'
        ? { approvalStatus: 'UNDER_REVIEW' as const }
        : {}),
    },
  });
}

export async function addDocument(
  vendorId: string,
  file: Express.Multer.File,
  data: { type: string; documentNo?: string; issueDate?: Date; expiryDate?: Date },
) {
  return prisma.vendorDocument.create({
    data: {
      vendorId,
      type: data.type as never,
      documentNo: data.documentNo ?? null,
      fileUrl: publicUrl('vendor-documents', file.filename),
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      issueDate: data.issueDate ?? null,
      expiryDate: data.expiryDate ?? null,
      status: 'PENDING',
    },
  });
}

export async function deleteDocument(vendorId: string, documentId: string) {
  const document = await prisma.vendorDocument.findFirst({ where: { id: documentId, vendorId } });
  if (!document) throw ApiError.notFound('Document not found');
  if (document.status === 'APPROVED') {
    throw ApiError.badRequest('Approved documents cannot be removed — contact support');
  }
  return prisma.vendorDocument.delete({ where: { id: documentId } });
}

/** Blocks catalog and order actions until the admin has approved the vendor. */
export async function assertApproved(vendorId: string): Promise<void> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { approvalStatus: true, isActive: true },
  });
  if (!vendor) throw ApiError.notFound('Vendor profile not found');
  if (vendor.approvalStatus !== 'APPROVED' || !vendor.isActive) {
    throw ApiError.forbidden(
      'Your vendor account is not approved yet. You can complete your profile but cannot sell until approval.',
    );
  }
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export async function listCatalog(vendorId: string, query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.VendorProductWhereInput = { vendorId, deletedAt: null };
  if (query.status) where.status = query.status as never;
  if (query.categoryId || query.manufacturerId || query.search) {
    where.product = {
      ...(query.categoryId ? { categoryId: query.categoryId as string } : {}),
      ...(query.manufacturerId ? { manufacturerId: query.manufacturerId as string } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search as string } },
              { genericName: { contains: query.search as string } },
              { brandName: { contains: query.search as string } },
              { sku: { contains: query.search as string } },
            ],
          }
        : {}),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.vendorProduct.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            genericName: true,
            brandName: true,
            packSize: true,
            imageUrl: true,
            prescriptionRequired: true,
            status: true,
            category: { select: { id: true, name: true } },
            manufacturer: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: query.sortOrder === 'asc' ? 'asc' : 'desc' },
      skip,
      take,
    }),
    prisma.vendorProduct.count({ where }),
  ]);

  const stock = await stockByProduct(
    { ownerType: 'VENDOR', vendorId },
    rows.map((row) => row.productId),
  );

  const items = rows
    .map((row) => ({ ...row, availableQty: stock.get(row.productId) ?? 0 }))
    .filter((row) => (query.inStockOnly ? row.availableQty > 0 : true));

  return { items, meta: buildMeta(page, limit, total) };
}

/** Available quantity per product for one owner, keyed by product id. */
export async function stockByProduct(
  owner: { ownerType: 'VENDOR' | 'RETAILER'; vendorId?: string; retailerId?: string },
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();

  const rows = await prisma.inventory.findMany({
    where: {
      productId: { in: productIds },
      warehouse:
        owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId },
    },
    select: { productId: true, availableQty: true },
  });

  return rows.reduce((map, row) => {
    map.set(row.productId, (map.get(row.productId) ?? 0) + row.availableQty);
    return map;
  }, new Map<string, number>());
}

export async function addCatalogProduct(
  vendorId: string,
  data: Record<string, unknown>,
  userId: string,
) {
  await assertApproved(vendorId);

  const product = await prisma.product.findFirst({
    where: { id: data.productId as string, deletedAt: null },
    select: { id: true, status: true, isRecalled: true, mrp: true, gstRate: true },
  });
  if (!product) throw ApiError.badRequest('Product not found in the master catalogue');
  if (product.status === 'BLOCKED' || product.isRecalled) {
    throw ApiError.badRequest('This product is blocked or recalled and cannot be listed');
  }

  const existing = await prisma.vendorProduct.findUnique({
    where: { vendorId_productId: { vendorId, productId: product.id } },
    select: { id: true, deletedAt: true },
  });

  if (existing && !existing.deletedAt) {
    throw ApiError.conflict('This product is already in your catalogue — edit it instead of adding a duplicate');
  }

  const payload = {
    ...data,
    vendorId,
    gstRate: data.gstRate ?? product.gstRate,
    mrp: data.mrp ?? product.mrp,
    deletedAt: null,
  };

  const saved = existing
    ? await prisma.vendorProduct.update({ where: { id: existing.id }, data: payload })
    : await prisma.vendorProduct.create({ data: payload as never });

  await recordPriceChanges({
    productId: product.id,
    ownerType: 'VENDOR',
    ownerId: vendorId,
    before: {},
    after: saved,
    changedById: userId,
  });

  return saved;
}

export async function updateCatalogProduct(
  vendorId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
) {
  const existing = await prisma.vendorProduct.findFirst({ where: { id, vendorId, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Catalogue entry not found');

  const sellingPrice = data.sellingPrice ?? existing.sellingPrice;
  const mrp = data.mrp ?? existing.mrp;
  if (toNumber(sellingPrice as never) > toNumber(mrp as never)) {
    throw ApiError.badRequest('Selling price cannot exceed MRP');
  }

  const updated = await prisma.vendorProduct.update({ where: { id }, data });

  await recordPriceChanges({
    productId: existing.productId,
    ownerType: 'VENDOR',
    ownerId: vendorId,
    before: existing,
    after: updated,
    changedById: userId,
  });

  return updated;
}

export async function removeCatalogProduct(vendorId: string, id: string) {
  const existing = await prisma.vendorProduct.findFirst({ where: { id, vendorId, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Catalogue entry not found');

  return prisma.vendorProduct.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'INACTIVE' },
  });
}

// ---------------------------------------------------------------------------
// Bulk import / export (TASKS.md #5, #21)
// ---------------------------------------------------------------------------

export const VENDOR_CATALOG_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'product.sku', header: 'SKU', width: 16 },
  { key: 'product.name', header: 'Product', width: 28 },
  { key: 'purchasePrice', header: 'Purchase price', width: 14, numeric: true },
  { key: 'sellingPrice', header: 'Selling price', width: 14, numeric: true },
  { key: 'mrp', header: 'MRP', width: 12, numeric: true },
  { key: 'gstRate', header: 'GST %', width: 10, numeric: true },
  { key: 'discountPct', header: 'Discount %', width: 12, numeric: true },
  { key: 'minOrderQty', header: 'Min order qty', width: 14, numeric: true },
  { key: 'packQty', header: 'Pack qty', width: 12, numeric: true },
  { key: 'minStockAlert', header: 'Min stock alert', width: 14, numeric: true },
  { key: 'status', header: 'Status', width: 12 },
];

export async function listCatalogForExport(vendorId: string) {
  return prisma.vendorProduct.findMany({
    where: { vendorId, deletedAt: null },
    include: { product: { select: { sku: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

/** Row identifies the product by SKU (human-editable) rather than the
 * `productId` UUID `addCatalogProduct` expects; upserts instead of that
 * function's "conflict on duplicate" behaviour since re-importing an
 * exported file to edit prices is the whole point of the round trip. */
export async function importCatalog(
  vendorId: string,
  rows: Record<string, string>[],
  userId: string,
): Promise<ImportResult> {
  await assertApproved(vendorId);

  return runImport(rows, async (row) => {
    const sku = row['SKU']?.trim().toUpperCase();
    if (!sku) throw ApiError.badRequest('SKU is required');

    const product = await prisma.product.findUnique({
      where: { sku },
      select: { id: true, status: true, isRecalled: true, mrp: true, gstRate: true },
    });
    if (!product) throw ApiError.badRequest(`Product with SKU "${sku}" not found in the master catalogue`);
    if (product.status === 'BLOCKED' || product.isRecalled) {
      throw ApiError.badRequest('This product is blocked or recalled and cannot be listed');
    }

    const parsed = vendorCatalogImportRowSchema.safeParse({
      purchasePrice: row['Purchase price'] || undefined,
      sellingPrice: row['Selling price'],
      mrp: row['MRP'] || String(product.mrp),
      gstRate: row['GST %'] || String(product.gstRate),
      discountPct: row['Discount %'] || undefined,
      minOrderQty: row['Min order qty'] || undefined,
      packQty: row['Pack qty'] || undefined,
      minStockAlert: row['Min stock alert'] || undefined,
      status: row['Status']?.toUpperCase() || undefined,
    });
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues.map((issue) => issue.message).join('; '));

    const existing = await prisma.vendorProduct.findUnique({
      where: { vendorId_productId: { vendorId, productId: product.id } },
    });

    const saved = await prisma.vendorProduct.upsert({
      where: { vendorId_productId: { vendorId, productId: product.id } },
      create: { ...parsed.data, vendorId, productId: product.id },
      update: { ...parsed.data, deletedAt: null },
    });

    await recordPriceChanges({
      productId: product.id,
      ownerType: 'VENDOR',
      ownerId: vendorId,
      before: existing ?? {},
      after: saved,
      changedById: userId,
    });

    return existing && !existing.deletedAt ? 'updated' : 'added';
  });
}

export async function bulkUpdatePrices(
  vendorId: string,
  items: { vendorProductId: string; sellingPrice?: number; purchasePrice?: number; discountPct?: number }[],
  userId: string,
) {
  const ids = items.map((item) => item.vendorProductId);
  const existing = await prisma.vendorProduct.findMany({
    where: { id: { in: ids }, vendorId, deletedAt: null },
  });
  const byId = new Map(existing.map((row) => [row.id, row]));

  const updated: string[] = [];
  for (const item of items) {
    const current = byId.get(item.vendorProductId);
    if (!current) continue;

    const sellingPrice = item.sellingPrice ?? toNumber(current.sellingPrice);
    if (sellingPrice > toNumber(current.mrp)) continue;

    const row = await prisma.vendorProduct.update({
      where: { id: current.id },
      data: {
        ...(item.sellingPrice !== undefined ? { sellingPrice: item.sellingPrice } : {}),
        ...(item.purchasePrice !== undefined ? { purchasePrice: item.purchasePrice } : {}),
        ...(item.discountPct !== undefined ? { discountPct: item.discountPct } : {}),
      },
    });

    await recordPriceChanges({
      productId: current.productId,
      ownerType: 'VENDOR',
      ownerId: vendorId,
      before: current,
      after: row,
      changedById: userId,
    });
    updated.push(row.id);
  }

  return { updated: updated.length, skipped: items.length - updated.length };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function dashboard(vendorId: string, days = 30) {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const rangeStart = startOfDay(dayjs().subtract(days - 1, 'day').toDate());

  const [
    todaysOrders,
    pendingOrders,
    totalProducts,
    stockAgg,
    lowStock,
    expiringStock,
    salesAgg,
    pendingPayments,
  ] = await Promise.all([
    prisma.purchaseOrder.count({ where: { vendorId, createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.purchaseOrder.count({ where: { vendorId, status: { in: ['PLACED', 'ACCEPTED', 'PROCESSING'] } } }),
    prisma.vendorProduct.count({ where: { vendorId, deletedAt: null, status: 'ACTIVE' } }),
    prisma.inventoryBatch.aggregate({
      where: { vendorId, status: 'ACTIVE', quantity: { gt: 0 } },
      _sum: { quantity: true, freeQuantity: true },
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM inventory i
      JOIN warehouses w ON w.id = i.warehouseId
      WHERE w.vendorId = ${vendorId} AND i.availableQty <= i.minStockAlert`,
    prisma.inventoryBatch.count({
      where: {
        vendorId,
        status: 'ACTIVE',
        quantity: { gt: 0 },
        expiryDate: { gt: new Date(), lte: dayjs().add(90, 'day').toDate() },
      },
    }),
    prisma.purchaseOrder.aggregate({
      where: { vendorId, status: { in: ['DELIVERED', 'RECEIVED', 'COMPLETED'] } },
      _sum: { totalAmount: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: { vendorId, paymentStatus: { in: ['PENDING', 'PARTIAL'] }, status: { notIn: ['CANCELLED', 'REJECTED'] } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
  ]);

  const [ordersTrend, salesTrend, topProducts, topRetailers] = await Promise.all([
    prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT DATE(createdAt) AS day, COUNT(*) AS count FROM purchase_orders
      WHERE vendorId = ${vendorId} AND createdAt >= ${rangeStart}
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
    prisma.$queryRaw<{ day: string; total: string }[]>`
      SELECT DATE(createdAt) AS day, COALESCE(SUM(totalAmount), 0) AS total FROM purchase_orders
      WHERE vendorId = ${vendorId} AND createdAt >= ${rangeStart}
        AND status IN ('DELIVERED','RECEIVED','COMPLETED')
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
    prisma.$queryRaw<{ id: string; name: string; qty: bigint; revenue: string }[]>`
      SELECT p.id, p.name, SUM(poi.quantity) AS qty, COALESCE(SUM(poi.totalAmount), 0) AS revenue
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.purchaseOrderId
      JOIN products p ON p.id = poi.productId
      WHERE po.vendorId = ${vendorId} AND po.createdAt >= ${rangeStart}
      GROUP BY p.id, p.name ORDER BY qty DESC LIMIT 10`,
    prisma.$queryRaw<{ id: string; storeName: string; orders: bigint; total: string }[]>`
      SELECT s.id, s.storeName, COUNT(po.id) AS orders, COALESCE(SUM(po.totalAmount), 0) AS total
      FROM purchase_orders po
      JOIN medical_shops s ON s.id = po.retailerId
      WHERE po.vendorId = ${vendorId} AND po.createdAt >= ${rangeStart}
      GROUP BY s.id, s.storeName ORDER BY total DESC LIMIT 10`,
  ]);

  const outstanding =
    toNumber(pendingPayments._sum.totalAmount ?? 0) - toNumber(pendingPayments._sum.paidAmount ?? 0);

  return {
    cards: {
      todaysOrders,
      pendingOrders,
      totalProducts,
      totalStock: (stockAgg._sum.quantity ?? 0) + (stockAgg._sum.freeQuantity ?? 0),
      lowStock: Number(lowStock[0]?.count ?? 0),
      expiringStock,
      totalSales: toNumber(salesAgg._sum.totalAmount ?? 0),
      pendingPayments: Math.max(0, outstanding),
    },
    charts: {
      ordersTrend: ordersTrend.map((row) => ({ day: dayjs(row.day).format('YYYY-MM-DD'), value: Number(row.count) })),
      salesTrend: salesTrend.map((row) => ({ day: dayjs(row.day).format('YYYY-MM-DD'), value: Number(row.total) })),
      topProducts: topProducts.map((row) => ({
        id: row.id,
        name: row.name,
        quantity: Number(row.qty),
        revenue: Number(row.revenue),
      })),
      topRetailers: topRetailers.map((row) => ({
        id: row.id,
        name: row.storeName,
        orders: Number(row.orders),
        amount: Number(row.total),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Per-retailer credit limit & payment terms (TASKS.md #9)
// ---------------------------------------------------------------------------

/** Sum of unpaid/partially-paid purchase orders between this vendor and
 * retailer — same status filter the vendor dashboard's own
 * `pendingPayments` card already uses, for consistency. */
export async function outstandingBalance(vendorId: string, retailerId: string): Promise<number> {
  const agg = await prisma.purchaseOrder.aggregate({
    where: {
      vendorId,
      retailerId,
      paymentStatus: { in: ['PENDING', 'PARTIAL'] },
      status: { notIn: ['CANCELLED', 'REJECTED', 'DRAFT'] },
    },
    _sum: { totalAmount: true, paidAmount: true },
  });
  return Math.max(0, toNumber(agg._sum.totalAmount ?? 0) - toNumber(agg._sum.paidAmount ?? 0));
}

/** Every retailer this vendor has ever received a purchase order from,
 * with its terms row if the vendor has set one — a vendor can't set terms
 * for a retailer it has never traded with. */
export async function listRetailerTerms(vendorId: string) {
  const retailers = await prisma.$queryRaw<{ id: string; storeName: string; city: string | null }[]>`
    SELECT DISTINCT s.id, s.storeName, s.city
    FROM purchase_orders po
    JOIN medical_shops s ON s.id = po.retailerId
    WHERE po.vendorId = ${vendorId}
    ORDER BY s.storeName ASC`;

  if (retailers.length === 0) return [];

  const terms = await prisma.vendorRetailerTerms.findMany({
    where: { vendorId, retailerId: { in: retailers.map((r) => r.id) } },
  });
  const termsByRetailer = new Map(terms.map((t) => [t.retailerId, t]));

  const balances = await Promise.all(retailers.map((r) => outstandingBalance(vendorId, r.id)));

  return retailers.map((retailer, index) => {
    const term = termsByRetailer.get(retailer.id);
    return {
      retailerId: retailer.id,
      storeName: retailer.storeName,
      city: retailer.city,
      creditLimit: term ? toNumber(term.creditLimit) : 0,
      paymentTermsDays: term?.paymentTermsDays ?? 0,
      outstandingBalance: round2ToNumber(balances[index]),
    };
  });
}

function round2ToNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function setRetailerTerms(
  vendorId: string,
  retailerId: string,
  data: { creditLimit: number; paymentTermsDays: number },
) {
  const hasTraded = await prisma.purchaseOrder.findFirst({ where: { vendorId, retailerId }, select: { id: true } });
  if (!hasTraded) throw ApiError.badRequest('Set terms once this retailer has placed at least one order with you');

  return prisma.vendorRetailerTerms.upsert({
    where: { vendorId_retailerId: { vendorId, retailerId } },
    create: { vendorId, retailerId, ...data },
    update: data,
  });
}

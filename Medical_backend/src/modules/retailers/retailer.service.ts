import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { buildMeta } from '../../utils/response';
import { getPagination } from '../../utils/pagination';
import { toNumber } from '../../utils/money';
import { dayjs, endOfDay, startOfDay, toDateOnly } from '../../utils/time';
import { recordPriceChanges } from '../../common/price-history';
import { publicUrl } from '../../middleware/upload';
import { toSignedUrl } from '../../lib/signed-url';
import { stockByProduct } from '../vendors/vendor.service';
import type { ExportColumn } from '../../utils/export';
import type { ImportResult } from '../../utils/csv-import';
import { runImport } from '../../utils/csv-import';
import { retailerCatalogImportRowSchema } from './retailer.validation';

export async function getProfile(retailerId: string) {
  const retailer = await prisma.retailer.findUnique({
    where: { id: retailerId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      documents: { orderBy: { createdAt: 'desc' } },
      images: { orderBy: { sortOrder: 'asc' } },
      businessHours: { orderBy: { dayOfWeek: 'asc' } },
      pickupConfig: true,
      warehouses: { orderBy: { isDefault: 'desc' } },
    },
  });
  if (!retailer) throw ApiError.notFound('Store profile not found');
  return {
    ...retailer,
    documents: retailer.documents.map((doc) => ({ ...doc, fileUrl: toSignedUrl(doc.fileUrl) ?? doc.fileUrl })),
  };
}

export async function updateProfile(retailerId: string, data: Record<string, unknown>) {
  const retailer = await getProfile(retailerId);

  const identityChanged =
    (data.gstNumber && data.gstNumber !== retailer.gstNumber) ||
    (data.drugLicenseNumber && data.drugLicenseNumber !== retailer.drugLicenseNumber);

  return prisma.retailer.update({
    where: { id: retailerId },
    data: {
      ...data,
      // '' means "clear the threshold" — the schema accepts it for that
      // reason, but the Decimal column needs null, not an empty string.
      ...(data.deliveryFreeAboveAmount === '' ? { deliveryFreeAboveAmount: null } : {}),
      ...(identityChanged && retailer.approvalStatus === 'APPROVED'
        ? { approvalStatus: 'UNDER_REVIEW' as const }
        : {}),
    } as never,
  });
}

export async function setTemporaryClosure(retailerId: string, isClosed: boolean, reason?: string) {
  return prisma.retailer.update({
    where: { id: retailerId },
    data: { isTemporarilyClosed: isClosed, closureReason: isClosed ? (reason ?? null) : null },
  });
}

export async function assertApproved(retailerId: string): Promise<void> {
  const retailer = await prisma.retailer.findUnique({
    where: { id: retailerId },
    select: { approvalStatus: true, isActive: true },
  });
  if (!retailer) throw ApiError.notFound('Store profile not found');
  if (retailer.approvalStatus !== 'APPROVED' || !retailer.isActive) {
    throw ApiError.forbidden(
      'Your store is not approved yet. You can complete your profile but cannot trade until approval.',
    );
  }
}

// ---------------------------------------------------------------------------
// Documents & images
// ---------------------------------------------------------------------------

export async function addDocument(
  retailerId: string,
  file: Express.Multer.File,
  data: { type: string; documentNo?: string; issueDate?: Date; expiryDate?: Date },
) {
  return prisma.shopDocument.create({
    data: {
      retailerId,
      type: data.type as never,
      documentNo: data.documentNo ?? null,
      fileUrl: publicUrl('shop-documents', file.filename),
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      issueDate: data.issueDate ?? null,
      expiryDate: data.expiryDate ?? null,
      status: 'PENDING',
    },
  });
}

export async function deleteDocument(retailerId: string, documentId: string) {
  const document = await prisma.shopDocument.findFirst({ where: { id: documentId, retailerId } });
  if (!document) throw ApiError.notFound('Document not found');
  if (document.status === 'APPROVED') {
    throw ApiError.badRequest('Approved documents cannot be removed — contact support');
  }
  return prisma.shopDocument.delete({ where: { id: documentId } });
}

export async function addImage(
  retailerId: string,
  file: Express.Multer.File,
  data: { caption?: string; sortOrder?: number },
) {
  return prisma.storeImage.create({
    data: {
      retailerId,
      url: publicUrl('store-images', file.filename),
      caption: data.caption ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function deleteImage(retailerId: string, imageId: string) {
  const image = await prisma.storeImage.findFirst({ where: { id: imageId, retailerId } });
  if (!image) throw ApiError.notFound('Image not found');
  return prisma.storeImage.delete({ where: { id: imageId } });
}

// ---------------------------------------------------------------------------
// Business hours & holidays
// ---------------------------------------------------------------------------

export async function setBusinessHours(
  retailerId: string,
  hours: {
    dayOfWeek: number;
    isClosed: boolean;
    openTime?: string;
    closeTime?: string;
    breakStart?: string;
    breakEnd?: string;
  }[],
) {
  await prisma.$transaction(
    hours.map((day) =>
      prisma.storeBusinessHour.upsert({
        where: { retailerId_dayOfWeek: { retailerId, dayOfWeek: day.dayOfWeek } },
        update: {
          isClosed: day.isClosed,
          openTime: day.isClosed ? null : (day.openTime ?? null),
          closeTime: day.isClosed ? null : (day.closeTime ?? null),
          breakStart: day.breakStart ?? null,
          breakEnd: day.breakEnd ?? null,
        },
        create: {
          retailerId,
          dayOfWeek: day.dayOfWeek,
          isClosed: day.isClosed,
          openTime: day.isClosed ? null : (day.openTime ?? null),
          closeTime: day.isClosed ? null : (day.closeTime ?? null),
          breakStart: day.breakStart ?? null,
          breakEnd: day.breakEnd ?? null,
        },
      }),
    ),
  );

  // Future slots are rebuilt lazily on the next availability read.
  await prisma.pickupSlot.deleteMany({
    where: { retailerId, date: { gte: toDateOnly(new Date()) }, bookedCount: 0 },
  });

  return prisma.storeBusinessHour.findMany({ where: { retailerId }, orderBy: { dayOfWeek: 'asc' } });
}

export async function listHolidays(retailerId: string) {
  return prisma.storeHoliday.findMany({
    where: { retailerId, date: { gte: dayjs().subtract(30, 'day').toDate() } },
    orderBy: { date: 'asc' },
  });
}

export async function addHoliday(
  retailerId: string,
  data: { date: Date; title?: string; isFullDay: boolean; openTime?: string; closeTime?: string },
) {
  const date = toDateOnly(data.date);

  const holiday = await prisma.storeHoliday.upsert({
    where: { retailerId_date: { retailerId, date } },
    update: {
      title: data.title ?? null,
      isFullDay: data.isFullDay,
      openTime: data.openTime ?? null,
      closeTime: data.closeTime ?? null,
    },
    create: {
      retailerId,
      date,
      title: data.title ?? null,
      isFullDay: data.isFullDay,
      openTime: data.openTime ?? null,
      closeTime: data.closeTime ?? null,
    },
  });

  const booked = await prisma.pickupSlot.count({
    where: { retailerId, date, bookedCount: { gt: 0 } },
  });

  await prisma.pickupSlot.updateMany({
    where: { retailerId, date, bookedCount: 0 },
    data: { status: 'DISABLED' },
  });

  return { holiday, bookedSlotsNeedingAttention: booked };
}

export async function deleteHoliday(retailerId: string, holidayId: string) {
  const holiday = await prisma.storeHoliday.findFirst({ where: { id: holidayId, retailerId } });
  if (!holiday) throw ApiError.notFound('Holiday not found');

  await prisma.storeHoliday.delete({ where: { id: holidayId } });
  await prisma.pickupSlot.updateMany({
    where: { retailerId, date: holiday.date, status: 'DISABLED' },
    data: { status: 'AVAILABLE' },
  });
  return { deleted: true };
}

export async function updatePickupConfig(retailerId: string, data: Record<string, unknown>) {
  const config = await prisma.pickupSlotConfig.upsert({
    where: { retailerId },
    update: data,
    create: { retailerId, ...data },
  });

  // Slot duration or capacity changes invalidate unbooked slots.
  if (data.slotDurationMins !== undefined) {
    await prisma.pickupSlot.deleteMany({
      where: { retailerId, date: { gte: toDateOnly(new Date()) }, bookedCount: 0 },
    });
  } else if (data.maxOrdersPerSlot !== undefined) {
    await prisma.pickupSlot.updateMany({
      where: { retailerId, date: { gte: toDateOnly(new Date()) } },
      data: { capacity: Number(data.maxOrdersPerSlot) },
    });
  }

  return config;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export async function listCatalog(retailerId: string, query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.RetailerProductWhereInput = { retailerId, deletedAt: null };
  if (query.status) where.status = query.status as never;
  if (query.categoryId || query.search) {
    where.product = {
      ...(query.categoryId ? { categoryId: query.categoryId as string } : {}),
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
    prisma.retailerProduct.findMany({
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
    prisma.retailerProduct.count({ where }),
  ]);

  const stock = await stockByProduct(
    { ownerType: 'RETAILER', retailerId },
    rows.map((row) => row.productId),
  );

  const items = rows
    .map((row) => {
      const availableQty = stock.get(row.productId) ?? 0;
      return { ...row, availableQty, isLowStock: availableQty <= row.minStockAlert };
    })
    .filter((row) => {
      if (query.inStockOnly && row.availableQty <= 0) return false;
      if (query.lowStockOnly && !row.isLowStock) return false;
      return true;
    });

  return { items, meta: buildMeta(page, limit, total) };
}

export async function addCatalogProduct(
  retailerId: string,
  data: Record<string, unknown>,
  userId: string,
) {
  await assertApproved(retailerId);

  const product = await prisma.product.findFirst({
    where: { id: data.productId as string, deletedAt: null },
    select: { id: true, status: true, isRecalled: true, mrp: true, gstRate: true },
  });
  if (!product) throw ApiError.badRequest('Product not found in the master catalogue');
  if (product.status === 'BLOCKED' || product.isRecalled) {
    throw ApiError.badRequest('This product is blocked or recalled and cannot be listed');
  }

  const existing = await prisma.retailerProduct.findUnique({
    where: { retailerId_productId: { retailerId, productId: product.id } },
    select: { id: true, deletedAt: true },
  });
  if (existing && !existing.deletedAt) {
    throw ApiError.conflict('This product is already in your catalogue — edit it instead of adding a duplicate');
  }

  const payload = {
    ...data,
    retailerId,
    gstRate: data.gstRate ?? product.gstRate,
    mrp: data.mrp ?? product.mrp,
    deletedAt: null,
  };

  const saved = existing
    ? await prisma.retailerProduct.update({ where: { id: existing.id }, data: payload })
    : await prisma.retailerProduct.create({ data: payload as never });

  await recordPriceChanges({
    productId: product.id,
    ownerType: 'RETAILER',
    ownerId: retailerId,
    before: {},
    after: saved,
    changedById: userId,
  });

  return saved;
}

export async function updateCatalogProduct(
  retailerId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
) {
  const existing = await prisma.retailerProduct.findFirst({ where: { id, retailerId, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Catalogue entry not found');

  const sellingPrice = data.sellingPrice ?? existing.sellingPrice;
  const mrp = data.mrp ?? existing.mrp;
  if (toNumber(sellingPrice as never) > toNumber(mrp as never)) {
    throw ApiError.badRequest('Selling price cannot exceed MRP');
  }

  const updated = await prisma.retailerProduct.update({ where: { id }, data });

  await recordPriceChanges({
    productId: existing.productId,
    ownerType: 'RETAILER',
    ownerId: retailerId,
    before: existing,
    after: updated,
    changedById: userId,
  });

  return updated;
}

export async function removeCatalogProduct(retailerId: string, id: string) {
  const existing = await prisma.retailerProduct.findFirst({ where: { id, retailerId, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Catalogue entry not found');

  return prisma.retailerProduct.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'INACTIVE' },
  });
}

// ---------------------------------------------------------------------------
// Bulk import / export (TASKS.md #5, #21)
// ---------------------------------------------------------------------------

export const RETAILER_CATALOG_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'product.sku', header: 'SKU', width: 16 },
  { key: 'product.name', header: 'Product', width: 28 },
  { key: 'sellingPrice', header: 'Selling price', width: 14, numeric: true },
  { key: 'mrp', header: 'MRP', width: 12, numeric: true },
  { key: 'gstRate', header: 'GST %', width: 10, numeric: true },
  { key: 'discountPct', header: 'Discount %', width: 12, numeric: true },
  { key: 'maxOrderQty', header: 'Max order qty', width: 14, numeric: true },
  { key: 'minStockAlert', header: 'Min stock alert', width: 14, numeric: true },
  { key: 'status', header: 'Status', width: 12 },
];

export async function listCatalogForExport(retailerId: string) {
  return prisma.retailerProduct.findMany({
    where: { retailerId, deletedAt: null },
    include: { product: { select: { sku: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

/** Same upsert-by-SKU shape as the vendor import — see
 * `vendor.service.ts#importCatalog` for why this upserts instead of reusing
 * `addCatalogProduct`'s add-only behaviour. */
export async function importCatalog(
  retailerId: string,
  rows: Record<string, string>[],
  userId: string,
): Promise<ImportResult> {
  await assertApproved(retailerId);

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

    const parsed = retailerCatalogImportRowSchema.safeParse({
      sellingPrice: row['Selling price'],
      mrp: row['MRP'] || String(product.mrp),
      gstRate: row['GST %'] || String(product.gstRate),
      discountPct: row['Discount %'] || undefined,
      maxOrderQty: row['Max order qty'] || undefined,
      minStockAlert: row['Min stock alert'] || undefined,
      status: row['Status']?.toUpperCase() || undefined,
    });
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues.map((issue) => issue.message).join('; '));

    const existing = await prisma.retailerProduct.findUnique({
      where: { retailerId_productId: { retailerId, productId: product.id } },
    });

    const saved = await prisma.retailerProduct.upsert({
      where: { retailerId_productId: { retailerId, productId: product.id } },
      create: { ...parsed.data, retailerId, productId: product.id },
      update: { ...parsed.data, deletedAt: null },
    });

    await recordPriceChanges({
      productId: product.id,
      ownerType: 'RETAILER',
      ownerId: retailerId,
      before: existing ?? {},
      after: saved,
      changedById: userId,
    });

    return existing && !existing.deletedAt ? 'updated' : 'added';
  });
}

// ---------------------------------------------------------------------------
// Vendor browsing (wholesale sourcing)
// ---------------------------------------------------------------------------

export async function listVendors(query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.VendorWhereInput = {
    deletedAt: null,
    approvalStatus: 'APPROVED',
    isActive: true,
    ...(query.city ? { city: query.city as string } : {}),
    ...(query.state ? { state: query.state as string } : {}),
    ...(query.search
      ? {
          OR: [
            { businessName: { contains: query.search as string } },
            { city: { contains: query.search as string } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      select: {
        id: true,
        code: true,
        businessName: true,
        city: true,
        state: true,
        pincode: true,
        logoUrl: true,
        description: true,
        minOrderValue: true,
        phone: true,
        gstNumber: true,
        _count: { select: { products: { where: { status: 'ACTIVE', deletedAt: null } } } },
      },
      orderBy: { businessName: 'asc' },
      skip,
      take,
    }),
    prisma.vendor.count({ where }),
  ]);

  return { items, meta: buildMeta(page, limit, total) };
}

export async function listVendorProducts(query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.VendorProductWhereInput = {
    deletedAt: null,
    status: 'ACTIVE',
    vendor: { approvalStatus: 'APPROVED', isActive: true, deletedAt: null },
    product: {
      deletedAt: null,
      status: 'ACTIVE',
      isRecalled: false,
      ...(query.categoryId ? { categoryId: query.categoryId as string } : {}),
      ...(query.manufacturerId ? { manufacturerId: query.manufacturerId as string } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search as string } },
              { genericName: { contains: query.search as string } },
              { brandName: { contains: query.search as string } },
            ],
          }
        : {}),
    },
    ...(query.vendorId ? { vendorId: query.vendorId as string } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.vendorProduct.findMany({
      where,
      include: {
        vendor: { select: { id: true, businessName: true, city: true, minOrderValue: true } },
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
            manufacturer: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { sellingPrice: 'asc' },
      skip,
      take,
    }),
    prisma.vendorProduct.count({ where }),
  ]);

  // Availability is resolved per vendor so retailers never order dead stock.
  const byVendor = new Map<string, string[]>();
  for (const row of rows) {
    byVendor.set(row.vendorId, [...(byVendor.get(row.vendorId) ?? []), row.productId]);
  }

  const availability = new Map<string, number>();
  for (const [vendorId, productIds] of byVendor) {
    const stock = await stockByProduct({ ownerType: 'VENDOR', vendorId }, productIds);
    for (const [productId, qty] of stock) availability.set(`${vendorId}:${productId}`, qty);
  }

  const items = rows
    .map((row) => ({
      ...row,
      availableQty: availability.get(`${row.vendorId}:${row.productId}`) ?? 0,
    }))
    .filter((row) => (query.inStockOnly ? row.availableQty > 0 : true));

  return { items, meta: buildMeta(page, limit, total) };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function dashboard(retailerId: string, days = 30) {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const rangeStart = startOfDay(dayjs().subtract(days - 1, 'day').toDate());

  const [
    todaysSalesAgg,
    todaysOrders,
    pendingOrders,
    totalProducts,
    stockAgg,
    lowStock,
    expiringProducts,
    pendingPurchases,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: {
        retailerId,
        createdAt: { gte: todayStart, lte: todayEnd },
        status: { in: ['PICKED_UP', 'DELIVERED', 'COMPLETED'] },
      },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({ where: { retailerId, createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.order.count({
      where: { retailerId, status: { in: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'] } },
    }),
    prisma.retailerProduct.count({ where: { retailerId, deletedAt: null, status: 'ACTIVE' } }),
    prisma.inventoryBatch.aggregate({
      where: { retailerId, status: 'ACTIVE', quantity: { gt: 0 } },
      _sum: { quantity: true, freeQuantity: true },
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM inventory i
      JOIN warehouses w ON w.id = i.warehouseId
      WHERE w.retailerId = ${retailerId} AND i.availableQty <= i.minStockAlert`,
    prisma.inventoryBatch.count({
      where: {
        retailerId,
        status: 'ACTIVE',
        quantity: { gt: 0 },
        expiryDate: { gt: new Date(), lte: dayjs().add(90, 'day').toDate() },
      },
    }),
    prisma.purchaseOrder.count({
      where: { retailerId, status: { in: ['PLACED', 'ACCEPTED', 'PROCESSING', 'DISPATCHED', 'DELIVERED'] } },
    }),
  ]);

  const [dailySales, monthlySales, topProducts, stockMovement] = await Promise.all([
    prisma.$queryRaw<{ day: string; total: string; orders: bigint }[]>`
      SELECT DATE(createdAt) AS day, COALESCE(SUM(totalAmount), 0) AS total, COUNT(*) AS orders
      FROM orders WHERE retailerId = ${retailerId} AND createdAt >= ${rangeStart}
        AND status IN ('PICKED_UP','DELIVERED','COMPLETED')
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
    prisma.$queryRaw<{ month: string; total: string }[]>`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, COALESCE(SUM(totalAmount), 0) AS total
      FROM orders WHERE retailerId = ${retailerId}
        AND createdAt >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        AND status IN ('PICKED_UP','DELIVERED','COMPLETED')
      GROUP BY month ORDER BY month ASC`,
    prisma.$queryRaw<{ id: string; name: string; qty: bigint; revenue: string }[]>`
      SELECT p.id, p.name, SUM(oi.quantity) AS qty, COALESCE(SUM(oi.totalAmount), 0) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.orderId
      JOIN products p ON p.id = oi.productId
      WHERE o.retailerId = ${retailerId} AND o.createdAt >= ${rangeStart}
      GROUP BY p.id, p.name ORDER BY qty DESC LIMIT 10`,
    prisma.$queryRaw<{ day: string; direction: string; qty: string }[]>`
      SELECT DATE(createdAt) AS day, direction, COALESCE(SUM(quantity), 0) AS qty
      FROM inventory_transactions
      WHERE retailerId = ${retailerId} AND createdAt >= ${rangeStart}
        AND direction IN ('IN','OUT')
      GROUP BY DATE(createdAt), direction ORDER BY day ASC`,
  ]);

  return {
    cards: {
      todaysSales: toNumber(todaysSalesAgg._sum.totalAmount ?? 0),
      todaysOrders,
      pendingOrders,
      totalProducts,
      currentStock: (stockAgg._sum.quantity ?? 0) + (stockAgg._sum.freeQuantity ?? 0),
      lowStock: Number(lowStock[0]?.count ?? 0),
      expiringProducts,
      pendingPurchases,
    },
    charts: {
      dailySales: dailySales.map((row) => ({
        day: dayjs(row.day).format('YYYY-MM-DD'),
        value: Number(row.total),
        orders: Number(row.orders),
      })),
      monthlySales: monthlySales.map((row) => ({ month: row.month, value: Number(row.total) })),
      topProducts: topProducts.map((row) => ({
        id: row.id,
        name: row.name,
        quantity: Number(row.qty),
        revenue: Number(row.revenue),
      })),
      stockMovement: stockMovement.map((row) => ({
        day: dayjs(row.day).format('YYYY-MM-DD'),
        direction: row.direction,
        quantity: Number(row.qty),
      })),
    },
  };
}

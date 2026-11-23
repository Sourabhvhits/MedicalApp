import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { buildMeta } from '../../utils/response';
import { getPagination } from '../../utils/pagination';
import { skuFromName } from '../../utils/numbering';
import type { ExportColumn } from '../../utils/export';
import type { ImportResult } from '../../utils/csv-import';
import { runImport } from '../../utils/csv-import';
import { NOTIFICATION_EVENTS } from '../../config/constants';
import { notify } from '../notifications/notification.service';
import { productCreateSchema } from './product.validation';
import type { ProductCreateInput, ProductListQuery, ProductUpdateInput } from './product.validation';

const LIST_INCLUDE = {
  category: { select: { id: true, name: true } },
  subCategory: { select: { id: true, name: true } },
  manufacturer: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ProductInclude;

const SORTABLE = ['name', 'mrp', 'createdAt', 'updatedAt'] as const;

function buildWhere(query: ProductListQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { deletedAt: null };

  if (query.status) where.status = query.status;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.subCategoryId) where.subCategoryId = query.subCategoryId;
  if (query.manufacturerId) where.manufacturerId = query.manufacturerId;
  if (query.prescriptionRequired !== undefined) where.prescriptionRequired = query.prescriptionRequired;

  if (query.minMrp !== undefined || query.maxMrp !== undefined) {
    where.mrp = {
      ...(query.minMrp !== undefined ? { gte: query.minMrp } : {}),
      ...(query.maxMrp !== undefined ? { lte: query.maxMrp } : {}),
    };
  }

  if (query.search) {
    // Indexed prefix-friendly search across the fields a pharmacist would type.
    where.OR = [
      { name: { contains: query.search } },
      { genericName: { contains: query.search } },
      { brandName: { contains: query.search } },
      { composition: { contains: query.search } },
      { sku: { contains: query.search } },
      { searchKeywords: { contains: query.search } },
    ];
  }

  return where;
}

export async function listProducts(query: ProductListQuery) {
  const { page, limit, skip, take } = getPagination(query);
  const where = buildWhere(query);
  const sortBy = (SORTABLE as readonly string[]).includes(query.sortBy ?? '')
    ? (query.sortBy as (typeof SORTABLE)[number])
    : 'createdAt';

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: { [sortBy]: query.sortOrder },
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, meta: buildMeta(page, limit, total) };
}

export async function getProduct(id: string) {
  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...LIST_INCLUDE,
      _count: { select: { vendorProducts: true, retailerProducts: true } },
    },
  });
  if (!product) throw ApiError.notFound('Product not found');
  return product;
}

/** Validates that every referenced master row exists and is usable. */
async function assertReferences(data: ProductCreateInput | ProductUpdateInput): Promise<void> {
  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw ApiError.badRequest('Category not found');
  }

  if (data.subCategoryId) {
    const sub = await prisma.subCategory.findFirst({
      where: { id: data.subCategoryId, deletedAt: null },
      select: { categoryId: true },
    });
    if (!sub) throw ApiError.badRequest('Sub category not found');
    if (data.categoryId && sub.categoryId !== data.categoryId) {
      throw ApiError.badRequest('Sub category does not belong to the selected category');
    }
  }

  if (data.manufacturerId) {
    const manufacturer = await prisma.manufacturer.findFirst({
      where: { id: data.manufacturerId, deletedAt: null },
      select: { id: true },
    });
    if (!manufacturer) throw ApiError.badRequest('Manufacturer not found');
  }

  if (data.unitId) {
    const unit = await prisma.productUnit.findUnique({ where: { id: data.unitId }, select: { id: true } });
    if (!unit) throw ApiError.badRequest('Unit not found');
  }
}

/**
 * Guards against duplicate master products — the catalogue is centralised, so
 * the same brand + strength + pack must not be entered twice.
 */
async function assertNotDuplicate(data: ProductCreateInput, excludeId?: string): Promise<void> {
  const duplicate = await prisma.product.findFirst({
    where: {
      deletedAt: null,
      name: data.name,
      brandName: data.brandName ?? null,
      strength: data.strength ?? null,
      packSize: data.packSize ?? null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, sku: true },
  });

  if (duplicate) {
    throw ApiError.conflict(
      `This product already exists in the master catalogue (SKU ${duplicate.sku}). Use the existing product instead of creating a duplicate.`,
    );
  }
}

export async function createProduct(data: ProductCreateInput, createdById?: string) {
  await assertReferences(data);
  await assertNotDuplicate(data);

  let sku = data.sku?.toUpperCase();
  if (sku) {
    const existing = await prisma.product.findUnique({ where: { sku }, select: { id: true } });
    if (existing) throw ApiError.conflict('A product with this SKU already exists');
  } else {
    const sequence = await prisma.product.count();
    sku = skuFromName(data.name, sequence + 1);
    // The generated SKU can collide after deletes — walk forward until it is free.
    let attempt = sequence + 1;
    while (await prisma.product.findUnique({ where: { sku }, select: { id: true } })) {
      attempt += 1;
      sku = skuFromName(data.name, attempt);
    }
  }

  return prisma.product.create({
    data: {
      ...data,
      sku,
      createdById: createdById ?? null,
      searchKeywords: [data.name, data.genericName, data.brandName].filter(Boolean).join(' ').slice(0, 500),
    },
    include: LIST_INCLUDE,
  });
}

export async function updateProduct(id: string, data: ProductUpdateInput) {
  const current = await getProduct(id);
  await assertReferences(data);

  if (data.name || data.brandName || data.strength || data.packSize) {
    await assertNotDuplicate(
      {
        ...current,
        ...data,
        name: data.name ?? current.name,
        brandName: data.brandName ?? current.brandName ?? undefined,
        strength: data.strength ?? current.strength ?? undefined,
        packSize: data.packSize ?? current.packSize ?? undefined,
      } as ProductCreateInput,
      id,
    );
  }

  const name = data.name ?? current.name;
  const genericName = data.genericName ?? current.genericName;
  const brandName = data.brandName ?? current.brandName;

  return prisma.product.update({
    where: { id },
    data: {
      ...data,
      searchKeywords: [name, genericName, brandName].filter(Boolean).join(' ').slice(0, 500),
    },
    include: LIST_INCLUDE,
  });
}

/**
 * Soft-deletes a product. Vendor and retailer catalog rows are deactivated so
 * the product disappears from storefronts without breaking order history.
 */
export async function deleteProduct(id: string) {
  await getProduct(id);

  return prisma.$transaction(async (tx) => {
    await tx.vendorProduct.updateMany({ where: { productId: id }, data: { status: 'INACTIVE' } });
    await tx.retailerProduct.updateMany({ where: { productId: id }, data: { status: 'INACTIVE' } });
    return tx.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
  });
}

export async function setProductStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED') {
  await getProduct(id);

  return prisma.$transaction(async (tx) => {
    // Blocking a product must immediately remove it from every storefront.
    if (status === 'BLOCKED') {
      await tx.vendorProduct.updateMany({ where: { productId: id }, data: { status: 'BLOCKED' } });
      await tx.retailerProduct.updateMany({ where: { productId: id }, data: { status: 'BLOCKED' } });
    }
    return tx.product.update({ where: { id }, data: { status }, include: LIST_INCLUDE });
  });
}

export async function setProductRecall(id: string, isRecalled: boolean, reason?: string) {
  const product = await getProduct(id);

  const updated = await prisma.$transaction(async (tx) => {
    if (isRecalled) {
      await tx.vendorProduct.updateMany({ where: { productId: id }, data: { status: 'BLOCKED' } });
      await tx.retailerProduct.updateMany({ where: { productId: id }, data: { status: 'BLOCKED' } });
      await tx.inventoryBatch.updateMany({ where: { productId: id }, data: { status: 'BLOCKED' } });
    }
    return tx.product.update({
      where: { id },
      data: {
        isRecalled,
        recallReason: isRecalled ? (reason ?? null) : null,
        status: isRecalled ? 'BLOCKED' : 'ACTIVE',
      },
      include: LIST_INCLUDE,
    });
  });

  // Blocking future sale isn't enough — anyone who already received this
  // product needs to be told directly (TASKS.md #26).
  if (isRecalled) {
    await notifyPastBuyers(id, product.name, reason);
  }

  return updated;
}

/** Tells every customer who already received this product that it's been recalled. */
async function notifyPastBuyers(productId: string, productName: string, reason?: string): Promise<void> {
  const pastOrderItems = await prisma.orderItem.findMany({
    where: {
      productId,
      order: { status: { in: ['PICKED_UP', 'DELIVERED', 'COMPLETED'] } },
    },
    select: { order: { select: { customer: { select: { userId: true } } } } },
  });

  const buyerUserIds = new Set(pastOrderItems.map((item) => item.order.customer.userId));
  await Promise.all(
    Array.from(buyerUserIds).map((userId) =>
      notify({
        userId,
        event: NOTIFICATION_EVENTS.PRODUCT_RECALLED,
        title: 'Product recall notice',
        body: `${productName}, which you previously purchased, has been recalled.${
          reason ? ` Reason: ${reason}.` : ''
        } Please stop use and contact the store you bought it from.`,
        data: { productId, productName, reason: reason ?? '' },
        channels: ['IN_APP', 'EMAIL'],
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Bulk import / export (TASKS.md #5, #21) — round-trips the same columns
// ---------------------------------------------------------------------------

export const PRODUCT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'sku', header: 'SKU', width: 16 },
  { key: 'name', header: 'Name', width: 28 },
  { key: 'genericName', header: 'Generic name', width: 20 },
  { key: 'brandName', header: 'Brand name', width: 20 },
  { key: 'manufacturer.name', header: 'Manufacturer', width: 20 },
  { key: 'category.name', header: 'Category', width: 18 },
  { key: 'subCategory.name', header: 'Sub category', width: 18 },
  { key: 'unit.name', header: 'Unit', width: 14 },
  { key: 'medicineType', header: 'Medicine type', width: 16 },
  { key: 'composition', header: 'Composition', width: 24 },
  { key: 'strength', header: 'Strength', width: 14 },
  { key: 'dosageForm', header: 'Dosage form', width: 14 },
  { key: 'packSize', header: 'Pack size', width: 14 },
  { key: 'mrp', header: 'MRP', width: 12, numeric: true },
  { key: 'gstRate', header: 'GST %', width: 10, numeric: true },
  { key: 'hsnCode', header: 'HSN code', width: 12 },
  { key: 'prescriptionRequired', header: 'Rx required', width: 12 },
  { key: 'status', header: 'Status', width: 12 },
];

/** Every active-filter-matching row, unpaginated — for an export file. */
export async function listProductsForExport(query: ProductListQuery) {
  const where = buildWhere(query);
  return prisma.product.findMany({ where, include: LIST_INCLUDE, orderBy: { name: 'asc' } });
}

async function resolveByName<T extends { id: string }>(
  label: string,
  name: string | undefined,
  finder: (name: string) => Promise<T | null>,
): Promise<string | undefined> {
  if (!name) return undefined;
  const match = await finder(name.trim());
  if (!match) throw ApiError.badRequest(`${label} "${name}" not found`);
  return match.id;
}

/** Resolves the export's human-readable name columns back to the ids
 * `productCreateSchema` expects, then runs each row through the exact same
 * `createProduct`/`updateProduct` validation every single-record save uses —
 * import is not a second, looser code path. */
export async function importProducts(rows: Record<string, string>[], createdById?: string): Promise<ImportResult> {
  return runImport(rows, async (row) => {
    const categoryId = await resolveByName('Category', row['Category'], (name) =>
      prisma.category.findFirst({ where: { name, deletedAt: null }, select: { id: true } }),
    );
    const subCategoryId = row['Sub category']
      ? await resolveByName('Sub category', row['Sub category'], (name) =>
          prisma.subCategory.findFirst({
            where: { name, deletedAt: null, ...(categoryId ? { categoryId } : {}) },
            select: { id: true },
          }),
        )
      : undefined;
    const manufacturerId = row['Manufacturer']
      ? await resolveByName('Manufacturer', row['Manufacturer'], (name) =>
          prisma.manufacturer.findFirst({ where: { name, deletedAt: null }, select: { id: true } }),
        )
      : undefined;
    const unitId = row['Unit']
      ? await resolveByName('Unit', row['Unit'], (name) => prisma.productUnit.findFirst({ where: { name }, select: { id: true } }))
      : undefined;

    const parsed = productCreateSchema.safeParse({
      name: row['Name'],
      genericName: row['Generic name'] || undefined,
      brandName: row['Brand name'] || undefined,
      manufacturerId,
      categoryId,
      subCategoryId,
      unitId,
      medicineType: row['Medicine type'] || undefined,
      composition: row['Composition'] || undefined,
      strength: row['Strength'] || undefined,
      dosageForm: row['Dosage form'] || undefined,
      packSize: row['Pack size'] || undefined,
      mrp: row['MRP'],
      gstRate: row['GST %'] || undefined,
      hsnCode: row['HSN code'] || undefined,
      prescriptionRequired: row['Rx required'],
      status: (row['Status']?.toUpperCase() as ProductCreateInput['status']) || undefined,
      sku: row['SKU'] || undefined,
    });
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues.map((issue) => issue.message).join('; '));
    }

    const sku = parsed.data.sku?.toUpperCase();
    const existing = sku ? await prisma.product.findUnique({ where: { sku }, select: { id: true } }) : null;

    if (existing) {
      await updateProduct(existing.id, parsed.data);
      return 'updated';
    }
    await createProduct(parsed.data, createdById);
    return 'added';
  });
}

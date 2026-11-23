import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { buildMeta } from '../../utils/response';
import { getPagination } from '../../utils/pagination';
import { boundingBox, haversineKm } from '../../utils/geo';
import { toNumber } from '../../utils/money';
import { storeOpenState } from '../retailers/pickup.service';

interface NearbyQuery {
  latitude?: number;
  longitude?: number;
  radius?: number;
  pincode?: string;
  city?: string;
  productId?: string;
  categoryId?: string;
  openNow?: boolean;
  search?: string;
  sortBy?: 'distance' | 'rating' | 'name';
  page?: number;
  limit?: number;
}

/**
 * Nearby store search. A bounding box built from the radius lets MySQL use the
 * (latitude, longitude) index, then the exact haversine distance filters and
 * orders the shortlist.
 */
export async function nearbyStores(query: NearbyQuery) {
  const { page, limit, skip, take } = getPagination(query);
  const hasLocation = query.latitude !== undefined && query.longitude !== undefined;

  if (!hasLocation && !query.pincode && !query.city && !query.search) {
    throw ApiError.badRequest('Share your location, or search by pincode, city or store name');
  }

  const radius = Math.min(query.radius ?? env.DEFAULT_SEARCH_RADIUS_KM, env.MAX_SEARCH_RADIUS_KM);

  const where: Prisma.RetailerWhereInput = {
    deletedAt: null,
    approvalStatus: 'APPROVED',
    isActive: true,
    ...(query.pincode ? { pincode: query.pincode } : {}),
    ...(query.city ? { city: { contains: query.city } } : {}),
    ...(query.search
      ? {
          OR: [
            { storeName: { contains: query.search } },
            { addressLine1: { contains: query.search } },
            { city: { contains: query.search } },
          ],
        }
      : {}),
  };

  if (hasLocation) {
    const box = boundingBox({ latitude: query.latitude!, longitude: query.longitude! }, radius);
    where.latitude = { gte: box.minLat, lte: box.maxLat };
    where.longitude = { gte: box.minLng, lte: box.maxLng };
  }

  // Only stores that actually list the requested product / category.
  if (query.productId || query.categoryId) {
    where.products = {
      some: {
        deletedAt: null,
        status: 'ACTIVE',
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.categoryId ? { product: { categoryId: query.categoryId } } : {}),
      },
    };
  }

  const candidates = await prisma.retailer.findMany({
    where,
    select: {
      id: true,
      code: true,
      storeName: true,
      logoUrl: true,
      description: true,
      addressLine1: true,
      addressLine2: true,
      landmark: true,
      city: true,
      state: true,
      pincode: true,
      phone: true,
      latitude: true,
      longitude: true,
      ratingAvg: true,
      ratingCount: true,
      isTemporarilyClosed: true,
      images: { select: { url: true }, take: 1, orderBy: { sortOrder: 'asc' } },
      _count: { select: { products: { where: { status: 'ACTIVE', deletedAt: null } } } },
    },
    // Bounded so the distance pass stays cheap even for dense cities.
    take: 500,
  });

  const withDistance = candidates
    .map((store) => {
      const distanceKm =
        hasLocation && store.latitude !== null && store.longitude !== null
          ? haversineKm(
              { latitude: query.latitude!, longitude: query.longitude! },
              { latitude: toNumber(store.latitude), longitude: toNumber(store.longitude) },
            )
          : null;
      return { ...store, distanceKm: distanceKm === null ? null : Number(distanceKm.toFixed(2)) };
    })
    .filter((store) => (hasLocation ? store.distanceKm !== null && store.distanceKm <= radius : true));

  const openStates = await Promise.all(
    withDistance.map(async (store) => ({ id: store.id, state: await storeOpenState({ id: store.id }) })),
  );
  const openById = new Map(openStates.map((entry) => [entry.id, entry.state]));

  let results = withDistance.map((store) => {
    const open = openById.get(store.id)!;
    return {
      ...store,
      ratingAvg: toNumber(store.ratingAvg),
      productCount: store._count.products,
      isOpen: open.isOpen,
      openTime: open.openTime,
      closeTime: open.closeTime,
      closedReason: open.reason,
      imageUrl: store.images[0]?.url ?? null,
    };
  });

  if (query.openNow) results = results.filter((store) => store.isOpen);

  results.sort((a, b) => {
    if (query.sortBy === 'rating') return b.ratingAvg - a.ratingAvg;
    if (query.sortBy === 'name') return a.storeName.localeCompare(b.storeName);
    if (a.distanceKm === null || b.distanceKm === null) return 0;
    return a.distanceKm - b.distanceKm;
  });

  return {
    items: results.slice(skip, skip + take),
    meta: buildMeta(page, limit, results.length),
  };
}

export async function getStore(retailerId: string) {
  const store = await prisma.retailer.findFirst({
    where: { id: retailerId, deletedAt: null, approvalStatus: 'APPROVED', isActive: true },
    select: {
      id: true,
      code: true,
      storeName: true,
      description: true,
      logoUrl: true,
      phone: true,
      email: true,
      addressLine1: true,
      addressLine2: true,
      landmark: true,
      city: true,
      state: true,
      pincode: true,
      latitude: true,
      longitude: true,
      ratingAvg: true,
      ratingCount: true,
      isTemporarilyClosed: true,
      closureReason: true,
      drugLicenseNumber: true,
      deliveryEnabled: true,
      deliveryChargeAmount: true,
      deliveryFreeAboveAmount: true,
      images: { orderBy: { sortOrder: 'asc' } },
      businessHours: { orderBy: { dayOfWeek: 'asc' } },
      holidays: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' }, take: 30 },
      pickupConfig: { select: { slotDurationMins: true, bufferMins: true, advanceDays: true, isEnabled: true } },
      _count: { select: { products: { where: { status: 'ACTIVE', deletedAt: null } } } },
    },
  });
  if (!store) throw ApiError.notFound('Store not found or not currently available');

  const open = await storeOpenState({ id: store.id });
  return {
    ...store,
    ratingAvg: toNumber(store.ratingAvg),
    productCount: store._count.products,
    isOpen: open.isOpen,
    openTime: open.openTime,
    closeTime: open.closeTime,
    closedReason: open.reason,
  };
}

/** Products a specific store currently offers, with live availability. */
export async function storeProducts(retailerId: string, query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);

  const store = await prisma.retailer.findFirst({
    where: { id: retailerId, deletedAt: null, approvalStatus: 'APPROVED', isActive: true },
    select: { id: true },
  });
  if (!store) throw ApiError.notFound('Store not found');

  const where: Prisma.RetailerProductWhereInput = {
    retailerId,
    deletedAt: null,
    status: 'ACTIVE',
    product: {
      deletedAt: null,
      status: 'ACTIVE',
      isRecalled: false,
      ...(query.categoryId ? { categoryId: query.categoryId as string } : {}),
      ...(query.subCategoryId ? { subCategoryId: query.subCategoryId as string } : {}),
      ...(query.manufacturerId ? { manufacturerId: query.manufacturerId as string } : {}),
      ...(query.prescriptionRequired !== undefined
        ? { prescriptionRequired: query.prescriptionRequired as boolean }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search as string } },
              { genericName: { contains: query.search as string } },
              { brandName: { contains: query.search as string } },
              { composition: { contains: query.search as string } },
            ],
          }
        : {}),
    },
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? {
          sellingPrice: {
            ...(query.minPrice !== undefined ? { gte: query.minPrice as number } : {}),
            ...(query.maxPrice !== undefined ? { lte: query.maxPrice as number } : {}),
          },
        }
      : {}),
  };

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
            strength: true,
            dosageForm: true,
            imageUrl: true,
            prescriptionRequired: true,
            composition: true,
            category: { select: { id: true, name: true } },
            manufacturer: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
      skip,
      take,
    }),
    prisma.retailerProduct.count({ where }),
  ]);

  const availability = await availabilityMap(
    retailerId,
    rows.map((row) => row.productId),
  );

  const withStock = rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    sellingPrice: toNumber(row.sellingPrice),
    mrp: toNumber(row.mrp),
    discountPct: toNumber(row.discountPct),
    gstRate: toNumber(row.gstRate),
    maxOrderQty: row.maxOrderQty,
    availableQty: availability.get(row.productId) ?? 0,
    inStock: (availability.get(row.productId) ?? 0) > 0,
    product: row.product,
  }));

  // Substitutes only need computing for the out-of-stock rows this response
  // actually surfaces (i.e. when the caller asked to see them at all).
  const outOfStock = withStock.filter((item) => !item.inStock);
  const substitutesByComposition =
    query.inStockOnly === false && outOfStock.length > 0
      ? await substitutesAtStore(
          retailerId,
          outOfStock.map((item) => item.product.composition),
          outOfStock.map((item) => item.productId),
        )
      : new Map<string, StoreSubstitute[]>();

  const items = withStock
    .map((item) => ({
      ...item,
      substitutes: item.inStock
        ? []
        : (substitutesByComposition.get(item.product.composition ?? '') ?? []),
    }))
    .filter((item) => (query.inStockOnly === false ? true : item.inStock));

  return { items, meta: buildMeta(page, limit, total) };
}

interface StoreSubstitute {
  productId: string;
  name: string;
  brandName: string | null;
  genericName: string | null;
  packSize: string | null;
  imageUrl: string | null;
  sellingPrice: number;
  mrp: number;
  availableQty: number;
}

/**
 * For each composition among a store's out-of-stock products, finds other
 * active, in-stock products at the SAME store sharing that composition
 * (TASKS.md #25 — "out of stock? here's the same salt, different brand").
 */
async function substitutesAtStore(
  retailerId: string,
  compositions: (string | null)[],
  excludeProductIds: string[],
): Promise<Map<string, StoreSubstitute[]>> {
  const distinctCompositions = Array.from(new Set(compositions.filter((c): c is string => Boolean(c))));
  if (distinctCompositions.length === 0) return new Map();

  const candidates = await prisma.retailerProduct.findMany({
    where: {
      retailerId,
      deletedAt: null,
      status: 'ACTIVE',
      productId: { notIn: excludeProductIds },
      product: {
        deletedAt: null,
        status: 'ACTIVE',
        isRecalled: false,
        composition: { in: distinctCompositions },
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          brandName: true,
          genericName: true,
          packSize: true,
          imageUrl: true,
          composition: true,
        },
      },
    },
  });
  if (candidates.length === 0) return new Map();

  const availability = await availabilityMap(
    retailerId,
    candidates.map((row) => row.productId),
  );

  const byComposition = new Map<string, StoreSubstitute[]>();
  for (const row of candidates) {
    const qty = availability.get(row.productId) ?? 0;
    if (qty <= 0) continue;
    const composition = row.product.composition!;
    const list = byComposition.get(composition) ?? [];
    list.push({
      productId: row.product.id,
      name: row.product.name,
      brandName: row.product.brandName,
      genericName: row.product.genericName,
      packSize: row.product.packSize,
      imageUrl: row.product.imageUrl,
      sellingPrice: toNumber(row.sellingPrice),
      mrp: toNumber(row.mrp),
      availableQty: qty,
    });
    byComposition.set(composition, list);
  }
  return byComposition;
}

/**
 * Sellable quantity per product for a store — excludes reserved, expired and
 * blocked batches so customers never see stock they cannot buy.
 */
export async function availabilityMap(
  retailerId: string,
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<{ productId: string; qty: string }[]>`
    SELECT b.productId AS productId,
           COALESCE(SUM(b.quantity + b.freeQuantity - b.reservedQty), 0) AS qty
    FROM inventory_batches b
    WHERE b.retailerId = ${retailerId}
      AND b.status = 'ACTIVE'
      AND b.expiryDate > CURDATE()
      AND b.productId IN (${Prisma.join(productIds)})
    GROUP BY b.productId`;

  return rows.reduce((map, row) => {
    map.set(row.productId, Math.max(0, Number(row.qty)));
    return map;
  }, new Map<string, number>());
}

/** Cross-store product search: which nearby stores have this medicine. */
export async function searchProducts(query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);
  const hasLocation = query.latitude !== undefined && query.longitude !== undefined;
  const radius = Math.min(
    (query.radius as number) ?? env.DEFAULT_SEARCH_RADIUS_KM,
    env.MAX_SEARCH_RADIUS_KM,
  );

  const retailerWhere: Prisma.RetailerWhereInput = {
    deletedAt: null,
    approvalStatus: 'APPROVED',
    isActive: true,
  };

  if (hasLocation) {
    const box = boundingBox(
      { latitude: query.latitude as number, longitude: query.longitude as number },
      radius,
    );
    retailerWhere.latitude = { gte: box.minLat, lte: box.maxLat };
    retailerWhere.longitude = { gte: box.minLng, lte: box.maxLng };
  }

  const where: Prisma.RetailerProductWhereInput = {
    deletedAt: null,
    status: 'ACTIVE',
    retailer: retailerWhere,
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
              { composition: { contains: query.search as string } },
            ],
          }
        : {}),
    },
  };

  const [rows, total] = await Promise.all([
    prisma.retailerProduct.findMany({
      where,
      include: {
        retailer: {
          select: {
            id: true,
            storeName: true,
            city: true,
            pincode: true,
            latitude: true,
            longitude: true,
            ratingAvg: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            genericName: true,
            brandName: true,
            packSize: true,
            imageUrl: true,
            prescriptionRequired: true,
            manufacturer: { select: { name: true } },
          },
        },
      },
      orderBy: { sellingPrice: 'asc' },
      skip,
      take,
    }),
    prisma.retailerProduct.count({ where }),
  ]);

  // Availability resolved per store so the listing reflects real stock.
  const byRetailer = new Map<string, string[]>();
  for (const row of rows) {
    byRetailer.set(row.retailerId, [...(byRetailer.get(row.retailerId) ?? []), row.productId]);
  }
  const availability = new Map<string, number>();
  for (const [storeId, productIds] of byRetailer) {
    const map = await availabilityMap(storeId, productIds);
    for (const [productId, qty] of map) availability.set(`${storeId}:${productId}`, qty);
  }

  const items = rows
    .map((row) => {
      const distanceKm =
        hasLocation && row.retailer.latitude !== null && row.retailer.longitude !== null
          ? Number(
              haversineKm(
                { latitude: query.latitude as number, longitude: query.longitude as number },
                {
                  latitude: toNumber(row.retailer.latitude),
                  longitude: toNumber(row.retailer.longitude),
                },
              ).toFixed(2),
            )
          : null;

      return {
        retailerProductId: row.id,
        sellingPrice: toNumber(row.sellingPrice),
        mrp: toNumber(row.mrp),
        discountPct: toNumber(row.discountPct),
        availableQty: availability.get(`${row.retailerId}:${row.productId}`) ?? 0,
        distanceKm,
        product: row.product,
        store: { ...row.retailer, ratingAvg: toNumber(row.retailer.ratingAvg) },
      };
    })
    .filter((item) => item.availableQty > 0 && (hasLocation ? (item.distanceKm ?? 0) <= radius : true));

  // Nothing in stock nearby for this search term — offer the same salt from
  // a different brand instead of just showing an empty result (TASKS.md #25).
  const substitutes =
    items.length === 0 && typeof query.search === 'string' && query.search.trim()
      ? await substitutesForSearch(query.search, retailerWhere, hasLocation, query, radius)
      : [];

  return { items, meta: buildMeta(page, limit, total), substitutes };
}

/**
 * Finds active, in-stock products (any store within the same search area)
 * sharing a composition with whatever active product(s) matched the search
 * term — used when the direct search comes back with nothing in stock.
 */
async function substitutesForSearch(
  search: string,
  retailerWhere: Prisma.RetailerWhereInput,
  hasLocation: boolean,
  query: Record<string, unknown>,
  radius: number,
): Promise<
  {
    retailerProductId: string;
    sellingPrice: number;
    mrp: number;
    availableQty: number;
    distanceKm: number | null;
    product: { id: string; name: string; genericName: string | null; brandName: string | null };
    store: { id: string; storeName: string };
  }[]
> {
  const matched = await prisma.product.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      isRecalled: false,
      OR: [
        { name: { contains: search } },
        { genericName: { contains: search } },
        { brandName: { contains: search } },
        { composition: { contains: search } },
      ],
    },
    select: { composition: true },
  });
  const compositions = Array.from(
    new Set(matched.map((product) => product.composition).filter((c): c is string => Boolean(c))),
  );
  if (compositions.length === 0) return [];

  const rows = await prisma.retailerProduct.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      retailer: retailerWhere,
      product: { deletedAt: null, status: 'ACTIVE', isRecalled: false, composition: { in: compositions } },
    },
    include: {
      retailer: { select: { id: true, storeName: true, latitude: true, longitude: true } },
      product: { select: { id: true, name: true, genericName: true, brandName: true } },
    },
    take: 20,
  });
  if (rows.length === 0) return [];

  const byRetailer = new Map<string, string[]>();
  for (const row of rows) {
    byRetailer.set(row.retailerId, [...(byRetailer.get(row.retailerId) ?? []), row.productId]);
  }
  const availability = new Map<string, number>();
  for (const [storeId, productIds] of byRetailer) {
    const map = await availabilityMap(storeId, productIds);
    for (const [productId, qty] of map) availability.set(`${storeId}:${productId}`, qty);
  }

  return rows
    .map((row) => {
      const distanceKm =
        hasLocation && row.retailer.latitude !== null && row.retailer.longitude !== null
          ? Number(
              haversineKm(
                { latitude: query.latitude as number, longitude: query.longitude as number },
                { latitude: toNumber(row.retailer.latitude), longitude: toNumber(row.retailer.longitude) },
              ).toFixed(2),
            )
          : null;
      return {
        retailerProductId: row.id,
        sellingPrice: toNumber(row.sellingPrice),
        mrp: toNumber(row.mrp),
        availableQty: availability.get(`${row.retailerId}:${row.productId}`) ?? 0,
        distanceKm,
        product: row.product,
        store: { id: row.retailer.id, storeName: row.retailer.storeName },
      };
    })
    .filter((item) => item.availableQty > 0 && (hasLocation ? (item.distanceKm ?? 0) <= radius : true))
    .slice(0, 10);
}

import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { toNumber } from '../../utils/money';
import { ORDER_RESERVED_STATUSES } from '../../config/constants';

export async function getProfile(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
        },
      },
      addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] },
    },
  });
  if (!customer) throw ApiError.notFound('Customer profile not found');
  return customer;
}

export async function updateProfile(
  customerId: string,
  userId: string,
  data: Record<string, unknown>,
) {
  const { firstName, lastName, email, avatarUrl, ...customerFields } = data;

  if (email) {
    const existing = await prisma.user.findFirst({
      where: { email: String(email).toLowerCase(), id: { not: userId } },
      select: { id: true },
    });
    if (existing) throw ApiError.conflict('This email is already used by another account');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName ? { firstName: String(firstName) } : {}),
        ...(lastName !== undefined ? { lastName: lastName as string } : {}),
        ...(email ? { email: String(email).toLowerCase(), emailVerifiedAt: null } : {}),
        ...(avatarUrl ? { avatarUrl: String(avatarUrl) } : {}),
      },
    }),
    prisma.customer.update({ where: { id: customerId }, data: customerFields }),
  ]);

  return getProfile(customerId);
}

export async function setLocation(customerId: string, latitude: number, longitude: number) {
  return prisma.customer.update({
    where: { id: customerId },
    data: { latitude, longitude },
    select: { id: true, latitude: true, longitude: true },
  });
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

export async function listAddresses(customerId: string) {
  return prisma.customerAddress.findMany({
    where: { customerId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function addAddress(customerId: string, data: Record<string, unknown>) {
  const count = await prisma.customerAddress.count({ where: { customerId } });
  const isDefault = Boolean(data.isDefault) || count === 0;

  if (isDefault) {
    await prisma.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
  }

  return prisma.customerAddress.create({ data: { ...data, customerId, isDefault } as never });
}

export async function updateAddress(customerId: string, id: string, data: Record<string, unknown>) {
  const address = await prisma.customerAddress.findFirst({ where: { id, customerId } });
  if (!address) throw ApiError.notFound('Address not found');

  if (data.isDefault) {
    await prisma.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
  }

  return prisma.customerAddress.update({ where: { id }, data });
}

export async function deleteAddress(customerId: string, id: string) {
  const address = await prisma.customerAddress.findFirst({ where: { id, customerId } });
  if (!address) throw ApiError.notFound('Address not found');

  await prisma.customerAddress.delete({ where: { id } });

  // Promote another address so the customer always has a default.
  if (address.isDefault) {
    const next = await prisma.customerAddress.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    if (next) await prisma.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
  }

  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Favourites & reviews
// ---------------------------------------------------------------------------

export async function listFavorites(customerId: string) {
  const favorites = await prisma.favorite.findMany({
    where: { customerId },
    include: {
      retailer: {
        select: { id: true, storeName: true, logoUrl: true, city: true, ratingAvg: true, isActive: true },
      },
      product: { select: { id: true, name: true, brandName: true, packSize: true, imageUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    stores: favorites
      .filter((favorite) => favorite.retailer)
      .map((favorite) => ({
        favoriteId: favorite.id,
        ...favorite.retailer!,
        ratingAvg: toNumber(favorite.retailer!.ratingAvg),
      })),
    products: favorites
      .filter((favorite) => favorite.product)
      .map((favorite) => ({ favoriteId: favorite.id, ...favorite.product! })),
  };
}

export async function toggleFavorite(
  customerId: string,
  input: { retailerId?: string; productId?: string },
) {
  const existing = await prisma.favorite.findFirst({
    where: {
      customerId,
      retailerId: input.retailerId ?? null,
      productId: input.productId ?? null,
    },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }

  await prisma.favorite.create({
    data: {
      customerId,
      retailerId: input.retailerId ?? null,
      productId: input.productId ?? null,
    },
  });
  return { favorited: true };
}

/** Reviews require a completed order at that store — no drive-by ratings. */
export async function addReview(
  customerId: string,
  input: { retailerId: string; orderId?: string; rating: number; comment?: string },
) {
  const completedOrder = await prisma.order.findFirst({
    where: {
      customerId,
      retailerId: input.retailerId,
      status: 'COMPLETED',
      ...(input.orderId ? { id: input.orderId } : {}),
    },
    select: { id: true },
  });
  if (!completedOrder) {
    throw ApiError.badRequest('You can review a store only after completing an order there');
  }

  const existing = await prisma.review.findFirst({
    where: { customerId, retailerId: input.retailerId, orderId: completedOrder.id },
  });

  const review = existing
    ? await prisma.review.update({
        where: { id: existing.id },
        data: { rating: input.rating, comment: input.comment ?? null },
      })
    : await prisma.review.create({
        data: {
          customerId,
          retailerId: input.retailerId,
          orderId: completedOrder.id,
          rating: input.rating,
          comment: input.comment ?? null,
        },
      });

  const aggregate = await prisma.review.aggregate({
    where: { retailerId: input.retailerId, isVisible: true },
    _avg: { rating: true },
    _count: true,
  });

  await prisma.retailer.update({
    where: { id: input.retailerId },
    data: {
      ratingAvg: aggregate._avg.rating ?? 0,
      ratingCount: aggregate._count,
    },
  });

  return review;
}

export async function listStoreReviews(retailerId: string) {
  return prisma.review.findMany({
    where: { retailerId, isVisible: true },
    include: { customer: { select: { user: { select: { firstName: true, lastName: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function dashboard(customerId: string) {
  const [activeOrders, recentOrders, favorites, totalOrders] = await Promise.all([
    prisma.order.findMany({
      where: { customerId, status: { in: ORDER_RESERVED_STATUSES } },
      include: {
        retailer: { select: { id: true, storeName: true, phone: true, addressLine1: true, city: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.order.findMany({
      where: { customerId, status: { in: ['COMPLETED', 'PICKED_UP', 'DELIVERED', 'CANCELLED', 'REJECTED'] } },
      include: {
        retailer: { select: { id: true, storeName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    listFavorites(customerId),
    prisma.order.count({ where: { customerId } }),
  ]);

  return {
    cards: {
      activeOrders: activeOrders.length,
      totalOrders,
      favoriteStores: favorites.stores.length,
      favoriteProducts: favorites.products.length,
    },
    activeOrders,
    recentOrders,
    favorites,
  };
}

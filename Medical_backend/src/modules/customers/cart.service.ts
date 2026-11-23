import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { toNumber } from '../../utils/money';
import { aggregateTax, computeLineTax } from '../../utils/tax';
import { availabilityMap } from './discovery.service';
import { checkInteractions, hasSevereInteraction, type InteractionWarning } from '../safety/safety.service';

/** Retail selling prices are MRP-based and already include GST. */
export const RETAIL_PRICE_INCLUDES_TAX = true;

const CART_INCLUDE = {
  retailer: {
    select: {
      id: true,
      storeName: true,
      logoUrl: true,
      city: true,
      phone: true,
      addressLine1: true,
      isTemporarilyClosed: true,
      approvalStatus: true,
      isActive: true,
    },
  },
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          packSize: true,
          imageUrl: true,
          prescriptionRequired: true,
          status: true,
          isRecalled: true,
          composition: true,
        },
      },
      retailerProduct: { select: { id: true, status: true, maxOrderQty: true, deletedAt: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

export async function getActiveCart(customerId: string) {
  return prisma.cart.findFirst({
    where: { customerId, isActive: true },
    include: CART_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  });
}

export interface CartSummary {
  cart: Awaited<ReturnType<typeof getActiveCart>>;
  items: {
    id: string;
    productId: string;
    retailerProductId: string;
    name: string;
    packSize: string | null;
    imageUrl: string | null;
    prescriptionRequired: boolean;
    quantity: number;
    availableQty: number;
    unitPrice: number;
    mrp: number;
    lineTotal: number;
    taxableAmount: number;
    taxAmount: number;
    issue?: string;
  }[];
  totals: {
    subtotal: number;
    discountAmount: number;
    taxableAmount: number;
    taxAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    totalAmount: number;
    itemCount: number;
  };
  issues: string[];
  requiresPrescription: boolean;
  interactionWarnings: InteractionWarning[];
}

/**
 * Prices the cart and reports any line that can no longer be fulfilled — the
 * same validation checkout runs, so the customer sees problems before paying.
 */
export async function summarizeCart(customerId: string): Promise<CartSummary | null> {
  const cart = await getActiveCart(customerId);
  if (!cart) return null;

  const availability = await availabilityMap(
    cart.retailerId,
    cart.items.map((item) => item.productId),
  );

  const issues: string[] = [];
  if (cart.retailer.approvalStatus !== 'APPROVED' || !cart.retailer.isActive) {
    issues.push('This store is no longer accepting orders');
  }

  const lines = cart.items.map((item) => {
    const availableQty = availability.get(item.productId) ?? 0;
    const tax = computeLineTax({
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      gstRate: item.gstRate,
      discountPct: item.discountPct,
      priceIncludesTax: RETAIL_PRICE_INCLUDES_TAX,
    });

    let issue: string | undefined;
    if (item.retailerProduct.deletedAt || item.retailerProduct.status !== 'ACTIVE') {
      issue = 'No longer sold by this store';
    } else if (item.product.status !== 'ACTIVE' || item.product.isRecalled) {
      issue = 'This product has been blocked or recalled';
    } else if (availableQty === 0) {
      issue = 'Out of stock';
    } else if (availableQty < item.quantity) {
      issue = `Only ${availableQty} left in stock`;
    } else if (item.quantity > item.retailerProduct.maxOrderQty) {
      issue = `Maximum ${item.retailerProduct.maxOrderQty} per order`;
    }

    if (issue) issues.push(`${item.product.name}: ${issue}`);

    return { item, availableQty, tax, issue };
  });

  const totals = aggregateTax(lines.map((line) => line.tax));
  const interactionWarnings = await checkInteractions(cart.items.map((item) => item.product.composition));

  return {
    cart,
    items: lines.map(({ item, availableQty, tax, issue }) => ({
      id: item.id,
      productId: item.productId,
      retailerProductId: item.retailerProductId,
      name: item.product.name,
      packSize: item.product.packSize,
      imageUrl: item.product.imageUrl,
      prescriptionRequired: item.product.prescriptionRequired,
      quantity: item.quantity,
      availableQty,
      unitPrice: toNumber(item.unitPrice),
      mrp: toNumber(item.mrp),
      lineTotal: toNumber(tax.totalAmount),
      taxableAmount: toNumber(tax.taxableAmount),
      taxAmount: toNumber(tax.taxAmount),
      issue,
    })),
    totals: {
      subtotal: toNumber(totals.subtotal),
      discountAmount: toNumber(totals.discountAmount),
      taxableAmount: toNumber(totals.taxableAmount),
      taxAmount: toNumber(totals.taxAmount),
      cgstAmount: toNumber(totals.cgstAmount),
      sgstAmount: toNumber(totals.sgstAmount),
      totalAmount: toNumber(totals.totalAmount),
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    },
    issues,
    // A severe interaction routes into the same upload-a-prescription gate
    // checkout() enforces, so the UI must ask for one here too — otherwise
    // the customer only discovers it after clicking "Place order".
    requiresPrescription:
      cart.items.some((item) => item.product.prescriptionRequired) || hasSevereInteraction(interactionWarnings),
    interactionWarnings,
  };
}

/**
 * Adds an item to the cart. A cart belongs to exactly one store — adding from
 * a different store requires `replaceCart`, which the UI prompts for.
 */
export async function addItem(
  customerId: string,
  input: { retailerProductId: string; quantity: number; replaceCart: boolean },
) {
  const retailerProduct = await prisma.retailerProduct.findFirst({
    where: { id: input.retailerProductId, deletedAt: null, status: 'ACTIVE' },
    include: {
      product: { select: { id: true, name: true, status: true, isRecalled: true } },
      retailer: { select: { id: true, storeName: true, approvalStatus: true, isActive: true, isTemporarilyClosed: true } },
    },
  });

  if (!retailerProduct) throw ApiError.notFound('This product is not available');
  if (retailerProduct.product.status !== 'ACTIVE' || retailerProduct.product.isRecalled) {
    throw ApiError.badRequest('This product is blocked or recalled and cannot be ordered');
  }
  if (retailerProduct.retailer.approvalStatus !== 'APPROVED' || !retailerProduct.retailer.isActive) {
    throw ApiError.badRequest('This store is not currently accepting orders');
  }

  const existingCart = await getActiveCart(customerId);

  if (existingCart && existingCart.retailerId !== retailerProduct.retailerId) {
    if (!input.replaceCart) {
      throw new ApiError(
        409,
        `This product is available from ${retailerProduct.retailer.storeName}. Your cart contains items from ${existingCart.retailer.storeName}. Would you like to create a new cart?`,
        'CART_STORE_CONFLICT',
        [
          { field: 'currentStore', message: existingCart.retailer.storeName },
          { field: 'newStore', message: retailerProduct.retailer.storeName },
        ],
      );
    }
    await prisma.cart.delete({ where: { id: existingCart.id } });
  }

  const cart =
    existingCart && existingCart.retailerId === retailerProduct.retailerId
      ? existingCart
      : await prisma.cart.create({
          data: { customerId, retailerId: retailerProduct.retailerId },
          include: CART_INCLUDE,
        });

  const existingItem = cart.items?.find((item) => item.retailerProductId === input.retailerProductId);
  const desiredQty = (existingItem?.quantity ?? 0) + input.quantity;

  if (desiredQty > retailerProduct.maxOrderQty) {
    throw ApiError.badRequest(
      `You can order at most ${retailerProduct.maxOrderQty} unit(s) of ${retailerProduct.product.name}`,
    );
  }

  const availability = await availabilityMap(retailerProduct.retailerId, [retailerProduct.productId]);
  const availableQty = availability.get(retailerProduct.productId) ?? 0;
  if (availableQty < desiredQty) {
    throw ApiError.badRequest(
      availableQty === 0 ? 'This product is out of stock' : `Only ${availableQty} unit(s) available`,
    );
  }

  await prisma.cartItem.upsert({
    where: { cartId_retailerProductId: { cartId: cart.id, retailerProductId: input.retailerProductId } },
    update: { quantity: desiredQty, unitPrice: retailerProduct.sellingPrice, mrp: retailerProduct.mrp },
    create: {
      cartId: cart.id,
      productId: retailerProduct.productId,
      retailerProductId: retailerProduct.id,
      quantity: desiredQty,
      unitPrice: retailerProduct.sellingPrice,
      mrp: retailerProduct.mrp,
      gstRate: retailerProduct.gstRate,
      discountPct: retailerProduct.discountPct,
    },
  });

  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
  return summarizeCart(customerId);
}

export async function updateItem(customerId: string, itemId: string, quantity: number) {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { customerId, isActive: true } },
    include: {
      cart: { select: { id: true, retailerId: true } },
      retailerProduct: { select: { maxOrderQty: true } },
      product: { select: { name: true } },
    },
  });
  if (!item) throw ApiError.notFound('Cart item not found');

  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: itemId } });
    return summarizeCart(customerId);
  }

  if (quantity > item.retailerProduct.maxOrderQty) {
    throw ApiError.badRequest(`You can order at most ${item.retailerProduct.maxOrderQty} unit(s)`);
  }

  const availability = await availabilityMap(item.cart.retailerId, [item.productId]);
  const availableQty = availability.get(item.productId) ?? 0;
  if (availableQty < quantity) {
    throw ApiError.badRequest(
      availableQty === 0 ? 'This product is out of stock' : `Only ${availableQty} unit(s) available`,
    );
  }

  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  return summarizeCart(customerId);
}

export async function removeItem(customerId: string, itemId: string) {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { customerId, isActive: true } },
    select: { id: true, cartId: true },
  });
  if (!item) throw ApiError.notFound('Cart item not found');

  await prisma.cartItem.delete({ where: { id: itemId } });

  const remaining = await prisma.cartItem.count({ where: { cartId: item.cartId } });
  if (remaining === 0) await prisma.cart.delete({ where: { id: item.cartId } });

  return summarizeCart(customerId);
}

export async function clearCart(customerId: string) {
  const cart = await getActiveCart(customerId);
  if (cart) await prisma.cart.delete({ where: { id: cart.id } });
  return { cleared: true };
}

export interface ReorderResult {
  cart: CartSummary | null;
  dropped: { productName: string; reason: string }[];
}

/**
 * TASKS.md #27 — builds a new cart from a past order's line items, reusing
 * `addItem`'s existing validation (recalled/inactive/stock/max-qty) per
 * line rather than a second, looser check. A past order references a
 * product, not the (mutable) catalogue listing, so each line resolves the
 * retailer's *current* `RetailerProduct` for that product first — if the
 * store no longer carries it, or any of `addItem`'s checks fail, that line
 * is skipped and reported back rather than failing the whole reorder.
 */
export async function reorder(customerId: string, pastOrderId: string, replaceCart = false): Promise<ReorderResult> {
  const pastOrder = await prisma.order.findFirst({
    where: { id: pastOrderId, customerId },
    include: { items: true },
  });
  if (!pastOrder) throw ApiError.notFound('Order not found');
  if (pastOrder.items.length === 0) throw ApiError.badRequest('This order has no items to reorder');

  // Same store-conflict UX as adding a single item (CART_STORE_CONFLICT) —
  // checked once up front since every line in this reorder shares one store.
  const existingCart = await getActiveCart(customerId);
  if (existingCart && existingCart.retailerId !== pastOrder.retailerId) {
    if (!replaceCart) {
      const retailer = await prisma.retailer.findUnique({
        where: { id: pastOrder.retailerId },
        select: { storeName: true },
      });
      throw new ApiError(
        409,
        `This order was from ${retailer?.storeName ?? 'a different store'}. Your cart has items from ${existingCart.retailer.storeName}. Replace your cart?`,
        'CART_STORE_CONFLICT',
        [
          { field: 'currentStore', message: existingCart.retailer.storeName },
          { field: 'newStore', message: retailer?.storeName ?? '' },
        ],
      );
    }
    await prisma.cart.delete({ where: { id: existingCart.id } });
  }

  const dropped: ReorderResult['dropped'] = [];

  for (const item of pastOrder.items) {
    const retailerProduct = await prisma.retailerProduct.findFirst({
      where: { retailerId: pastOrder.retailerId, productId: item.productId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!retailerProduct) {
      dropped.push({ productName: item.productName, reason: 'No longer sold by this store' });
      continue;
    }

    try {
      await addItem(customerId, {
        retailerProductId: retailerProduct.id,
        quantity: item.quantity,
        replaceCart: false,
      });
    } catch (error) {
      dropped.push({
        productName: item.productName,
        reason: error instanceof ApiError ? error.message : 'Could not be added',
      });
    }
  }

  return { cart: await summarizeCart(customerId), dropped };
}

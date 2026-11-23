"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RETAIL_PRICE_INCLUDES_TAX = void 0;
exports.getActiveCart = getActiveCart;
exports.summarizeCart = summarizeCart;
exports.addItem = addItem;
exports.updateItem = updateItem;
exports.removeItem = removeItem;
exports.clearCart = clearCart;
const prisma_1 = require("../../database/prisma");
const ApiError_1 = require("../../utils/ApiError");
const money_1 = require("../../utils/money");
const tax_1 = require("../../utils/tax");
const discovery_service_1 = require("./discovery.service");
/** Retail selling prices are MRP-based and already include GST. */
exports.RETAIL_PRICE_INCLUDES_TAX = true;
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
                },
            },
            retailerProduct: { select: { id: true, status: true, maxOrderQty: true, deletedAt: true } },
        },
        orderBy: { createdAt: 'asc' },
    },
};
async function getActiveCart(customerId) {
    return prisma_1.prisma.cart.findFirst({
        where: { customerId, isActive: true },
        include: CART_INCLUDE,
        orderBy: { updatedAt: 'desc' },
    });
}
/**
 * Prices the cart and reports any line that can no longer be fulfilled — the
 * same validation checkout runs, so the customer sees problems before paying.
 */
async function summarizeCart(customerId) {
    const cart = await getActiveCart(customerId);
    if (!cart)
        return null;
    const availability = await (0, discovery_service_1.availabilityMap)(cart.retailerId, cart.items.map((item) => item.productId));
    const issues = [];
    if (cart.retailer.approvalStatus !== 'APPROVED' || !cart.retailer.isActive) {
        issues.push('This store is no longer accepting orders');
    }
    const lines = cart.items.map((item) => {
        const availableQty = availability.get(item.productId) ?? 0;
        const tax = (0, tax_1.computeLineTax)({
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            gstRate: item.gstRate,
            discountPct: item.discountPct,
            priceIncludesTax: exports.RETAIL_PRICE_INCLUDES_TAX,
        });
        let issue;
        if (item.retailerProduct.deletedAt || item.retailerProduct.status !== 'ACTIVE') {
            issue = 'No longer sold by this store';
        }
        else if (item.product.status !== 'ACTIVE' || item.product.isRecalled) {
            issue = 'This product has been blocked or recalled';
        }
        else if (availableQty === 0) {
            issue = 'Out of stock';
        }
        else if (availableQty < item.quantity) {
            issue = `Only ${availableQty} left in stock`;
        }
        else if (item.quantity > item.retailerProduct.maxOrderQty) {
            issue = `Maximum ${item.retailerProduct.maxOrderQty} per order`;
        }
        if (issue)
            issues.push(`${item.product.name}: ${issue}`);
        return { item, availableQty, tax, issue };
    });
    const totals = (0, tax_1.aggregateTax)(lines.map((line) => line.tax));
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
            unitPrice: (0, money_1.toNumber)(item.unitPrice),
            mrp: (0, money_1.toNumber)(item.mrp),
            lineTotal: (0, money_1.toNumber)(tax.totalAmount),
            taxableAmount: (0, money_1.toNumber)(tax.taxableAmount),
            taxAmount: (0, money_1.toNumber)(tax.taxAmount),
            issue,
        })),
        totals: {
            subtotal: (0, money_1.toNumber)(totals.subtotal),
            discountAmount: (0, money_1.toNumber)(totals.discountAmount),
            taxableAmount: (0, money_1.toNumber)(totals.taxableAmount),
            taxAmount: (0, money_1.toNumber)(totals.taxAmount),
            cgstAmount: (0, money_1.toNumber)(totals.cgstAmount),
            sgstAmount: (0, money_1.toNumber)(totals.sgstAmount),
            totalAmount: (0, money_1.toNumber)(totals.totalAmount),
            itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        },
        issues,
        requiresPrescription: cart.items.some((item) => item.product.prescriptionRequired),
    };
}
/**
 * Adds an item to the cart. A cart belongs to exactly one store — adding from
 * a different store requires `replaceCart`, which the UI prompts for.
 */
async function addItem(customerId, input) {
    const retailerProduct = await prisma_1.prisma.retailerProduct.findFirst({
        where: { id: input.retailerProductId, deletedAt: null, status: 'ACTIVE' },
        include: {
            product: { select: { id: true, name: true, status: true, isRecalled: true } },
            retailer: { select: { id: true, storeName: true, approvalStatus: true, isActive: true, isTemporarilyClosed: true } },
        },
    });
    if (!retailerProduct)
        throw ApiError_1.ApiError.notFound('This product is not available');
    if (retailerProduct.product.status !== 'ACTIVE' || retailerProduct.product.isRecalled) {
        throw ApiError_1.ApiError.badRequest('This product is blocked or recalled and cannot be ordered');
    }
    if (retailerProduct.retailer.approvalStatus !== 'APPROVED' || !retailerProduct.retailer.isActive) {
        throw ApiError_1.ApiError.badRequest('This store is not currently accepting orders');
    }
    const existingCart = await getActiveCart(customerId);
    if (existingCart && existingCart.retailerId !== retailerProduct.retailerId) {
        if (!input.replaceCart) {
            throw new ApiError_1.ApiError(409, `This product is available from ${retailerProduct.retailer.storeName}. Your cart contains items from ${existingCart.retailer.storeName}. Would you like to create a new cart?`, 'CART_STORE_CONFLICT', [
                { field: 'currentStore', message: existingCart.retailer.storeName },
                { field: 'newStore', message: retailerProduct.retailer.storeName },
            ]);
        }
        await prisma_1.prisma.cart.delete({ where: { id: existingCart.id } });
    }
    const cart = existingCart && existingCart.retailerId === retailerProduct.retailerId
        ? existingCart
        : await prisma_1.prisma.cart.create({
            data: { customerId, retailerId: retailerProduct.retailerId },
            include: CART_INCLUDE,
        });
    const existingItem = cart.items?.find((item) => item.retailerProductId === input.retailerProductId);
    const desiredQty = (existingItem?.quantity ?? 0) + input.quantity;
    if (desiredQty > retailerProduct.maxOrderQty) {
        throw ApiError_1.ApiError.badRequest(`You can order at most ${retailerProduct.maxOrderQty} unit(s) of ${retailerProduct.product.name}`);
    }
    const availability = await (0, discovery_service_1.availabilityMap)(retailerProduct.retailerId, [retailerProduct.productId]);
    const availableQty = availability.get(retailerProduct.productId) ?? 0;
    if (availableQty < desiredQty) {
        throw ApiError_1.ApiError.badRequest(availableQty === 0 ? 'This product is out of stock' : `Only ${availableQty} unit(s) available`);
    }
    await prisma_1.prisma.cartItem.upsert({
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
    await prisma_1.prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
    return summarizeCart(customerId);
}
async function updateItem(customerId, itemId, quantity) {
    const item = await prisma_1.prisma.cartItem.findFirst({
        where: { id: itemId, cart: { customerId, isActive: true } },
        include: {
            cart: { select: { id: true, retailerId: true } },
            retailerProduct: { select: { maxOrderQty: true } },
            product: { select: { name: true } },
        },
    });
    if (!item)
        throw ApiError_1.ApiError.notFound('Cart item not found');
    if (quantity === 0) {
        await prisma_1.prisma.cartItem.delete({ where: { id: itemId } });
        return summarizeCart(customerId);
    }
    if (quantity > item.retailerProduct.maxOrderQty) {
        throw ApiError_1.ApiError.badRequest(`You can order at most ${item.retailerProduct.maxOrderQty} unit(s)`);
    }
    const availability = await (0, discovery_service_1.availabilityMap)(item.cart.retailerId, [item.productId]);
    const availableQty = availability.get(item.productId) ?? 0;
    if (availableQty < quantity) {
        throw ApiError_1.ApiError.badRequest(availableQty === 0 ? 'This product is out of stock' : `Only ${availableQty} unit(s) available`);
    }
    await prisma_1.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return summarizeCart(customerId);
}
async function removeItem(customerId, itemId) {
    const item = await prisma_1.prisma.cartItem.findFirst({
        where: { id: itemId, cart: { customerId, isActive: true } },
        select: { id: true, cartId: true },
    });
    if (!item)
        throw ApiError_1.ApiError.notFound('Cart item not found');
    await prisma_1.prisma.cartItem.delete({ where: { id: itemId } });
    const remaining = await prisma_1.prisma.cartItem.count({ where: { cartId: item.cartId } });
    if (remaining === 0)
        await prisma_1.prisma.cart.delete({ where: { id: item.cartId } });
    return summarizeCart(customerId);
}
async function clearCart(customerId) {
    const cart = await getActiveCart(customerId);
    if (cart)
        await prisma_1.prisma.cart.delete({ where: { id: cart.id } });
    return { cleared: true };
}
//# sourceMappingURL=cart.service.js.map
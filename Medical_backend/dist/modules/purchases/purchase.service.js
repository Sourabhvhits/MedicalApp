"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.purchaseOrderInclude = void 0;
exports.getPurchaseOrder = getPurchaseOrder;
exports.listPurchaseOrders = listPurchaseOrders;
exports.createPurchaseOrder = createPurchaseOrder;
exports.acceptPurchaseOrder = acceptPurchaseOrder;
exports.rejectPurchaseOrder = rejectPurchaseOrder;
exports.updateStatus = updateStatus;
exports.dispatchPurchaseOrder = dispatchPurchaseOrder;
exports.receivePurchaseOrder = receivePurchaseOrder;
exports.cancelPurchaseOrder = cancelPurchaseOrder;
exports.createInvoiceForPurchaseOrder = createInvoiceForPurchaseOrder;
exports.recordPurchasePayment = recordPurchasePayment;
exports.createPurchaseReturn = createPurchaseReturn;
exports.listPurchaseReturns = listPurchaseReturns;
const prisma_1 = require("../../database/prisma");
const ApiError_1 = require("../../utils/ApiError");
const response_1 = require("../../utils/response");
const pagination_1 = require("../../utils/pagination");
const money_1 = require("../../utils/money");
const tax_1 = require("../../utils/tax");
const numbering_1 = require("../../utils/numbering");
const time_1 = require("../../utils/time");
const constants_1 = require("../../config/constants");
const notification_service_1 = require("../notifications/notification.service");
const inventory = __importStar(require("../inventory/inventory.service"));
/** Wholesale prices are quoted exclusive of GST. */
const WHOLESALE_PRICE_INCLUDES_TAX = false;
const DETAIL_INCLUDE = {
    vendor: {
        select: { id: true, businessName: true, code: true, phone: true, email: true, gstNumber: true, city: true, state: true, addressLine1: true },
    },
    retailer: {
        select: { id: true, storeName: true, code: true, phone: true, email: true, gstNumber: true, city: true, state: true, addressLine1: true },
    },
    items: {
        include: {
            product: { select: { id: true, name: true, sku: true, packSize: true, hsnCode: true, imageUrl: true } },
        },
    },
    invoice: true,
    payments: { orderBy: { paidAt: 'desc' } },
};
exports.purchaseOrderInclude = DETAIL_INCLUDE;
async function getPurchaseOrder(id, scope) {
    const order = await prisma_1.prisma.purchaseOrder.findFirst({
        where: {
            id,
            ...(scope?.vendorId ? { vendorId: scope.vendorId } : {}),
            ...(scope?.retailerId ? { retailerId: scope.retailerId } : {}),
        },
        include: DETAIL_INCLUDE,
    });
    if (!order)
        throw ApiError_1.ApiError.notFound('Purchase order not found');
    return order;
}
async function listPurchaseOrders(scope, query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = {
        ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
        ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.vendorId && !scope.vendorId ? { vendorId: query.vendorId } : {}),
        ...(query.retailerId && !scope.retailerId ? { retailerId: query.retailerId } : {}),
        ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    };
    if (query.search) {
        where.OR = [
            { poNumber: { contains: query.search } },
            { vendor: { businessName: { contains: query.search } } },
            { retailer: { storeName: { contains: query.search } } },
        ];
    }
    if (query.dateFrom || query.dateTo) {
        where.createdAt = {
            ...(query.dateFrom ? { gte: (0, time_1.startOfDay)(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: (0, time_1.endOfDay)(query.dateTo) } : {}),
        };
    }
    const [items, total] = await Promise.all([
        prisma_1.prisma.purchaseOrder.findMany({
            where,
            include: {
                vendor: { select: { id: true, businessName: true, code: true } },
                retailer: { select: { id: true, storeName: true, code: true } },
                _count: { select: { items: true } },
            },
            orderBy: { createdAt: query.sortOrder === 'asc' ? 'asc' : 'desc' },
            skip,
            take,
        }),
        prisma_1.prisma.purchaseOrder.count({ where }),
    ]);
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
// ---------------------------------------------------------------------------
// Create (retailer side)
// ---------------------------------------------------------------------------
async function createPurchaseOrder(retailerId, input) {
    const [retailer, vendor] = await Promise.all([
        prisma_1.prisma.retailer.findUnique({
            where: { id: retailerId },
            select: { id: true, storeName: true, gstNumber: true, approvalStatus: true, isActive: true, userId: true },
        }),
        prisma_1.prisma.vendor.findUnique({
            where: { id: input.vendorId },
            select: { id: true, businessName: true, gstNumber: true, approvalStatus: true, isActive: true, minOrderValue: true, userId: true },
        }),
    ]);
    if (!retailer || retailer.approvalStatus !== 'APPROVED' || !retailer.isActive) {
        throw ApiError_1.ApiError.forbidden('Your store must be approved before placing purchase orders');
    }
    if (!vendor || vendor.approvalStatus !== 'APPROVED' || !vendor.isActive) {
        throw ApiError_1.ApiError.badRequest('This vendor is not available for orders');
    }
    const vendorProducts = await prisma_1.prisma.vendorProduct.findMany({
        where: {
            id: { in: input.items.map((item) => item.vendorProductId) },
            vendorId: vendor.id,
            status: 'ACTIVE',
            deletedAt: null,
        },
        include: { product: { select: { id: true, name: true, status: true, isRecalled: true } } },
    });
    const byId = new Map(vendorProducts.map((vp) => [vp.id, vp]));
    const interState = (0, tax_1.isInterState)(vendor.gstNumber, retailer.gstNumber);
    const lines = input.items.map((item) => {
        const vendorProduct = byId.get(item.vendorProductId);
        if (!vendorProduct)
            throw ApiError_1.ApiError.badRequest('One or more products are no longer offered by this vendor');
        if (vendorProduct.product.status !== 'ACTIVE' || vendorProduct.product.isRecalled) {
            throw ApiError_1.ApiError.badRequest(`${vendorProduct.product.name} is blocked or recalled and cannot be ordered`);
        }
        if (item.quantity < vendorProduct.minOrderQty) {
            throw ApiError_1.ApiError.badRequest(`${vendorProduct.product.name} has a minimum order quantity of ${vendorProduct.minOrderQty}`);
        }
        const tax = (0, tax_1.computeLineTax)({
            unitPrice: vendorProduct.sellingPrice,
            quantity: item.quantity,
            gstRate: vendorProduct.gstRate,
            discountPct: vendorProduct.discountPct,
            priceIncludesTax: WHOLESALE_PRICE_INCLUDES_TAX,
            interState,
        });
        return { vendorProduct, quantity: item.quantity, tax };
    });
    const totals = (0, tax_1.aggregateTax)(lines.map((line) => line.tax));
    if ((0, money_1.toNumber)(vendor.minOrderValue) > 0 && totals.totalAmount.lessThan((0, money_1.D)(vendor.minOrderValue))) {
        throw ApiError_1.ApiError.badRequest(`This vendor has a minimum order value of ₹${(0, money_1.toNumber)(vendor.minOrderValue).toFixed(2)}`);
    }
    const order = await prisma_1.prisma.$transaction(async (tx) => {
        const poNumber = await (0, numbering_1.nextDocumentNumber)(tx, 'purchaseOrder');
        return tx.purchaseOrder.create({
            data: {
                poNumber,
                retailerId,
                vendorId: vendor.id,
                status: 'PLACED',
                expectedDate: input.expectedDate ? (0, time_1.toDateOnly)(input.expectedDate) : null,
                notes: input.notes ?? null,
                subtotal: totals.subtotal,
                discountAmount: totals.discountAmount,
                taxableAmount: totals.taxableAmount,
                cgstAmount: totals.cgstAmount,
                sgstAmount: totals.sgstAmount,
                igstAmount: totals.igstAmount,
                taxAmount: totals.taxAmount,
                totalAmount: totals.totalAmount,
                items: {
                    create: lines.map((line) => ({
                        productId: line.vendorProduct.productId,
                        productName: line.vendorProduct.product.name,
                        quantity: line.quantity,
                        unitPrice: line.vendorProduct.sellingPrice,
                        mrp: line.vendorProduct.mrp,
                        discountPct: line.vendorProduct.discountPct,
                        discountAmount: line.tax.discountAmount,
                        gstRate: line.vendorProduct.gstRate,
                        taxableAmount: line.tax.taxableAmount,
                        taxAmount: line.tax.taxAmount,
                        totalAmount: line.tax.totalAmount,
                    })),
                },
            },
            include: DETAIL_INCLUDE,
        });
    });
    await (0, notification_service_1.notify)({
        userId: vendor.userId,
        event: constants_1.NOTIFICATION_EVENTS.PURCHASE_ORDER_PLACED,
        title: 'New purchase order',
        body: `${retailer.storeName} placed purchase order ${order.poNumber} worth ₹${(0, money_1.toNumber)(order.totalAmount).toFixed(2)}.`,
        data: { purchaseOrderId: order.id, poNumber: order.poNumber },
        channels: ['IN_APP', 'EMAIL'],
    });
    return order;
}
// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------
function assertTransition(from, to) {
    if (!constants_1.PURCHASE_ORDER_TRANSITIONS[from].includes(to)) {
        throw ApiError_1.ApiError.badRequest(`A purchase order cannot move from ${from} to ${to}`);
    }
}
/** Vendor accepts, optionally trimming quantities and prices. */
async function acceptPurchaseOrder(vendorId, id, input) {
    const order = await getPurchaseOrder(id, { vendorId });
    assertTransition(order.status, 'ACCEPTED');
    const interState = (0, tax_1.isInterState)(order.vendor.gstNumber, order.retailer.gstNumber);
    const overrides = new Map((input.items ?? []).map((item) => [item.itemId, item]));
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        const lines = order.items.map((item) => {
            const override = overrides.get(item.id);
            const acceptedQty = override ? override.acceptedQty : item.quantity;
            const freeQty = override?.freeQty ?? item.freeQty;
            const unitPrice = override?.unitPrice ?? (0, money_1.toNumber)(item.unitPrice);
            if (acceptedQty > item.quantity) {
                throw ApiError_1.ApiError.badRequest(`Accepted quantity for ${item.productName} exceeds the ordered quantity`);
            }
            const tax = (0, tax_1.computeLineTax)({
                unitPrice,
                quantity: acceptedQty,
                gstRate: item.gstRate,
                discountPct: item.discountPct,
                priceIncludesTax: WHOLESALE_PRICE_INCLUDES_TAX,
                interState,
            });
            return { item, acceptedQty, freeQty, unitPrice, tax };
        });
        if (lines.every((line) => line.acceptedQty === 0)) {
            throw ApiError_1.ApiError.badRequest('At least one line must be accepted — reject the order instead');
        }
        for (const line of lines) {
            await tx.purchaseOrderItem.update({
                where: { id: line.item.id },
                data: {
                    acceptedQty: line.acceptedQty,
                    freeQty: line.freeQty,
                    unitPrice: (0, money_1.D)(line.unitPrice),
                    discountAmount: line.tax.discountAmount,
                    taxableAmount: line.tax.taxableAmount,
                    taxAmount: line.tax.taxAmount,
                    totalAmount: line.tax.totalAmount,
                },
            });
        }
        const totals = (0, tax_1.aggregateTax)(lines.map((line) => line.tax));
        return tx.purchaseOrder.update({
            where: { id },
            data: {
                status: 'ACCEPTED',
                acceptedAt: new Date(),
                notes: input.notes ?? order.notes,
                subtotal: totals.subtotal,
                discountAmount: totals.discountAmount,
                taxableAmount: totals.taxableAmount,
                cgstAmount: totals.cgstAmount,
                sgstAmount: totals.sgstAmount,
                igstAmount: totals.igstAmount,
                taxAmount: totals.taxAmount,
                totalAmount: totals.totalAmount,
            },
            include: DETAIL_INCLUDE,
        });
    });
    const retailerUser = await prisma_1.prisma.retailer.findUnique({
        where: { id: order.retailerId },
        select: { userId: true },
    });
    if (retailerUser) {
        await (0, notification_service_1.notify)({
            userId: retailerUser.userId,
            event: constants_1.NOTIFICATION_EVENTS.PURCHASE_ORDER_ACCEPTED,
            title: 'Purchase order accepted',
            body: `${order.vendor.businessName} accepted purchase order ${order.poNumber}.`,
            data: { purchaseOrderId: id, poNumber: order.poNumber },
            channels: ['IN_APP', 'EMAIL'],
        });
    }
    return updated;
}
async function rejectPurchaseOrder(vendorId, id, reason) {
    const order = await getPurchaseOrder(id, { vendorId });
    assertTransition(order.status, 'REJECTED');
    const updated = await prisma_1.prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'REJECTED', rejectionReason: reason },
        include: DETAIL_INCLUDE,
    });
    const retailer = await prisma_1.prisma.retailer.findUnique({
        where: { id: order.retailerId },
        select: { userId: true },
    });
    if (retailer) {
        await (0, notification_service_1.notify)({
            userId: retailer.userId,
            event: constants_1.NOTIFICATION_EVENTS.PURCHASE_ORDER_REJECTED,
            title: 'Purchase order rejected',
            body: `${order.vendor.businessName} rejected purchase order ${order.poNumber}. Reason: ${reason}`,
            data: { purchaseOrderId: id },
            channels: ['IN_APP', 'EMAIL'],
        });
    }
    return updated;
}
async function updateStatus(scope, id, status) {
    const order = await getPurchaseOrder(id, scope);
    assertTransition(order.status, status);
    return prisma_1.prisma.purchaseOrder.update({
        where: { id },
        data: {
            status,
            ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        },
        include: DETAIL_INCLUDE,
    });
}
/**
 * Vendor dispatch: records logistics details, stamps batch/expiry onto each
 * line and deducts the vendor's own stock (FEFO) with full transaction trail.
 */
async function dispatchPurchaseOrder(vendorId, id, input, userId) {
    const order = await getPurchaseOrder(id, { vendorId });
    assertTransition(order.status, 'DISPATCHED');
    const batchByItem = new Map(input.items.map((item) => [item.itemId, item]));
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        const warehouseId = await inventory.resolveWarehouse(tx, { ownerType: 'VENDOR', vendorId });
        for (const item of order.items) {
            const shipQty = item.acceptedQty + item.freeQty;
            if (shipQty === 0)
                continue;
            const batch = batchByItem.get(item.id);
            if (!batch)
                throw ApiError_1.ApiError.badRequest(`Batch details are missing for ${item.productName}`);
            await inventory.stockOut(tx, { ownerType: 'VENDOR', vendorId }, warehouseId, item.productId, shipQty, 'SALE', { referenceType: 'PURCHASE_ORDER', referenceId: id, performedById: userId });
            await tx.purchaseOrderItem.update({
                where: { id: item.id },
                data: {
                    batchNumber: batch.batchNumber,
                    manufacturingDate: batch.manufacturingDate ? (0, time_1.toDateOnly)(batch.manufacturingDate) : null,
                    expiryDate: (0, time_1.toDateOnly)(batch.expiryDate),
                },
            });
        }
        return tx.purchaseOrder.update({
            where: { id },
            data: {
                status: 'DISPATCHED',
                dispatchNumber: input.dispatchNumber ?? null,
                courierName: input.courierName ?? null,
                trackingNumber: input.trackingNumber ?? null,
                dispatchDate: input.dispatchDate ?? new Date(),
            },
            include: DETAIL_INCLUDE,
        });
    });
    await createInvoiceForPurchaseOrder(id);
    const retailer = await prisma_1.prisma.retailer.findUnique({
        where: { id: order.retailerId },
        select: { userId: true },
    });
    if (retailer) {
        await (0, notification_service_1.notify)({
            userId: retailer.userId,
            event: constants_1.NOTIFICATION_EVENTS.PURCHASE_ORDER_DISPATCHED,
            title: 'Purchase order dispatched',
            body: `Purchase order ${order.poNumber} has been dispatched${input.courierName ? ` via ${input.courierName}` : ''}.`,
            data: { purchaseOrderId: id, trackingNumber: input.trackingNumber },
            channels: ['IN_APP', 'EMAIL'],
        });
    }
    return updated;
}
/**
 * Retailer receives goods: creates batch-wise stock, the inventory
 * transactions and the payable finance entry in one database transaction.
 */
async function receivePurchaseOrder(retailerId, id, input, userId) {
    const order = await getPurchaseOrder(id, { retailerId });
    if (!['DISPATCHED', 'DELIVERED'].includes(order.status)) {
        throw ApiError_1.ApiError.badRequest('Only dispatched or delivered purchase orders can be received');
    }
    const receiptByItem = new Map(input.items.map((item) => [item.itemId, item]));
    return prisma_1.prisma.$transaction(async (tx) => {
        const warehouseId = await inventory.resolveWarehouse(tx, { ownerType: 'RETAILER', retailerId }, input.warehouseId);
        for (const item of order.items) {
            const receipt = receiptByItem.get(item.id);
            if (!receipt || receipt.receivedQty + receipt.freeQty === 0)
                continue;
            const expected = item.acceptedQty + item.freeQty;
            if (receipt.receivedQty + receipt.freeQty > expected) {
                throw ApiError_1.ApiError.badRequest(`Received quantity for ${item.productName} exceeds the dispatched quantity (${expected})`);
            }
            await inventory.stockIn(tx, { ownerType: 'RETAILER', retailerId }, warehouseId, {
                productId: item.productId,
                batchNumber: receipt.batchNumber,
                quantity: receipt.receivedQty,
                freeQuantity: receipt.freeQty,
                purchasePrice: receipt.purchasePrice ?? (0, money_1.toNumber)(item.unitPrice),
                sellingPrice: receipt.sellingPrice ?? (0, money_1.toNumber)(item.mrp),
                mrp: receipt.mrp ?? (0, money_1.toNumber)(item.mrp),
                gstRate: (0, money_1.toNumber)(item.gstRate),
                manufacturingDate: receipt.manufacturingDate ?? null,
                expiryDate: receipt.expiryDate,
                supplierName: order.vendor.businessName,
                supplierVendorId: order.vendorId,
            }, 'PURCHASE', { referenceType: 'PURCHASE_ORDER', referenceId: id, notes: input.notes, performedById: userId });
            await tx.purchaseOrderItem.update({
                where: { id: item.id },
                data: { receivedQty: receipt.receivedQty },
            });
        }
        // The retailer now owes the vendor for this consignment.
        await tx.financeTransaction.create({
            data: {
                ownerType: 'RETAILER',
                retailerId,
                type: 'PURCHASE',
                direction: 'OUT',
                amount: order.totalAmount,
                taxAmount: order.taxAmount,
                referenceType: 'PURCHASE_ORDER',
                referenceId: id,
                partyName: order.vendor.businessName,
                description: `Purchase order ${order.poNumber}`,
            },
        });
        await tx.financeTransaction.create({
            data: {
                ownerType: 'VENDOR',
                vendorId: order.vendorId,
                type: 'SALE',
                direction: 'IN',
                amount: order.totalAmount,
                taxAmount: order.taxAmount,
                referenceType: 'PURCHASE_ORDER',
                referenceId: id,
                partyName: order.retailer.storeName,
                description: `Purchase order ${order.poNumber}`,
            },
        });
        return tx.purchaseOrder.update({
            where: { id },
            data: { status: 'RECEIVED', receivedAt: new Date() },
            include: DETAIL_INCLUDE,
        });
    });
}
async function cancelPurchaseOrder(retailerId, id, reason) {
    const order = await getPurchaseOrder(id, { retailerId });
    assertTransition(order.status, 'CANCELLED');
    return prisma_1.prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'CANCELLED', rejectionReason: reason ?? null },
        include: DETAIL_INCLUDE,
    });
}
// ---------------------------------------------------------------------------
// Invoicing & payments
// ---------------------------------------------------------------------------
async function createInvoiceForPurchaseOrder(purchaseOrderId) {
    const existing = await prisma_1.prisma.invoice.findUnique({ where: { purchaseOrderId } });
    if (existing)
        return existing;
    const order = await prisma_1.prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: {
            vendor: { select: { id: true, businessName: true } },
            retailer: { select: { storeName: true, gstNumber: true, addressLine1: true, city: true, state: true, pincode: true } },
        },
    });
    if (!order)
        throw ApiError_1.ApiError.notFound('Purchase order not found');
    return prisma_1.prisma.$transaction(async (tx) => {
        const invoiceNumber = await (0, numbering_1.nextDocumentNumber)(tx, 'invoice');
        return tx.invoice.create({
            data: {
                invoiceNumber,
                type: 'PURCHASE',
                ownerType: 'VENDOR',
                vendorId: order.vendorId,
                purchaseOrderId,
                billToName: order.retailer.storeName,
                billToGst: order.retailer.gstNumber,
                billToAddress: [order.retailer.addressLine1, order.retailer.city, order.retailer.state, order.retailer.pincode]
                    .filter(Boolean)
                    .join(', '),
                subtotal: order.subtotal,
                discountAmount: order.discountAmount,
                taxableAmount: order.taxableAmount,
                cgstAmount: order.cgstAmount,
                sgstAmount: order.sgstAmount,
                igstAmount: order.igstAmount,
                totalAmount: order.totalAmount,
                status: 'PENDING',
            },
        });
    });
}
async function recordPurchasePayment(retailerId, purchaseOrderId, input) {
    const order = await getPurchaseOrder(purchaseOrderId, { retailerId });
    const outstanding = (0, money_1.round2)((0, money_1.D)(order.totalAmount).sub((0, money_1.D)(order.paidAmount)));
    if ((0, money_1.D)(input.amount).greaterThan(outstanding)) {
        throw ApiError_1.ApiError.badRequest(`Payment exceeds the outstanding amount of ₹${outstanding.toFixed(2)}`);
    }
    return prisma_1.prisma.$transaction(async (tx) => {
        const paymentNumber = await (0, numbering_1.nextDocumentNumber)(tx, 'payment');
        const payment = await tx.payment.create({
            data: {
                paymentNumber,
                ownerType: 'RETAILER',
                retailerId,
                purchaseOrderId,
                invoiceId: order.invoice?.id ?? null,
                direction: 'OUT',
                mode: input.mode,
                amount: (0, money_1.D)(input.amount),
                status: 'PAID',
                referenceNo: input.referenceNo ?? null,
                paidAt: input.paidAt ?? new Date(),
                notes: input.notes ?? null,
            },
        });
        const paidAmount = (0, money_1.round2)((0, money_1.D)(order.paidAmount).add((0, money_1.D)(input.amount)));
        const paymentStatus = paidAmount.greaterThanOrEqualTo((0, money_1.D)(order.totalAmount))
            ? 'PAID'
            : paidAmount.greaterThan(0)
                ? 'PARTIAL'
                : 'PENDING';
        await tx.purchaseOrder.update({
            where: { id: purchaseOrderId },
            data: { paidAmount, paymentStatus },
        });
        if (order.invoice) {
            await tx.invoice.update({
                where: { id: order.invoice.id },
                data: { paidAmount, status: paymentStatus },
            });
        }
        await tx.financeTransaction.create({
            data: {
                ownerType: 'RETAILER',
                retailerId,
                type: 'PAYMENT_OUT',
                direction: 'OUT',
                amount: (0, money_1.D)(input.amount),
                referenceType: 'PURCHASE_ORDER',
                referenceId: purchaseOrderId,
                partyName: order.vendor.businessName,
                description: `Payment for ${order.poNumber}`,
            },
        });
        await tx.financeTransaction.create({
            data: {
                ownerType: 'VENDOR',
                vendorId: order.vendorId,
                type: 'PAYMENT_IN',
                direction: 'IN',
                amount: (0, money_1.D)(input.amount),
                referenceType: 'PURCHASE_ORDER',
                referenceId: purchaseOrderId,
                partyName: order.retailer.storeName,
                description: `Payment received for ${order.poNumber}`,
            },
        });
        return payment;
    });
}
// ---------------------------------------------------------------------------
// Purchase returns
// ---------------------------------------------------------------------------
async function createPurchaseReturn(retailerId, input, userId) {
    return prisma_1.prisma.$transaction(async (tx) => {
        const warehouseId = await inventory.resolveWarehouse(tx, { ownerType: 'RETAILER', retailerId });
        const returnNumber = await (0, numbering_1.nextDocumentNumber)(tx, 'purchaseReturn');
        let totalAmount = (0, money_1.D)(0);
        let taxAmount = (0, money_1.D)(0);
        const items = input.items.map((item) => {
            const tax = (0, tax_1.computeLineTax)({
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                gstRate: item.gstRate,
                priceIncludesTax: WHOLESALE_PRICE_INCLUDES_TAX,
            });
            totalAmount = totalAmount.add(tax.totalAmount);
            taxAmount = taxAmount.add(tax.taxAmount);
            return { ...item, totalAmount: tax.totalAmount };
        });
        const created = await tx.purchaseReturn.create({
            data: {
                returnNumber,
                retailerId,
                vendorId: input.vendorId,
                purchaseOrderId: input.purchaseOrderId ?? null,
                reason: input.reason,
                totalAmount: (0, money_1.round2)(totalAmount),
                taxAmount: (0, money_1.round2)(taxAmount),
                status: 'PENDING',
                items: {
                    create: items.map((item) => ({
                        productId: item.productId,
                        batchNumber: item.batchNumber ?? null,
                        quantity: item.quantity,
                        unitPrice: (0, money_1.D)(item.unitPrice),
                        gstRate: (0, money_1.D)(item.gstRate),
                        totalAmount: item.totalAmount,
                    })),
                },
            },
            include: { items: true },
        });
        // Returned goods leave the retailer's stock immediately.
        for (const item of input.items) {
            await inventory.stockOut(tx, { ownerType: 'RETAILER', retailerId }, warehouseId, item.productId, item.quantity, 'PURCHASE_RETURN', { referenceType: 'PURCHASE_RETURN', referenceId: created.id, notes: input.reason, performedById: userId });
        }
        await tx.financeTransaction.create({
            data: {
                ownerType: 'RETAILER',
                retailerId,
                type: 'PURCHASE_RETURN',
                direction: 'IN',
                amount: (0, money_1.round2)(totalAmount),
                taxAmount: (0, money_1.round2)(taxAmount),
                referenceType: 'PURCHASE_RETURN',
                referenceId: created.id,
                description: `Purchase return ${returnNumber}`,
            },
        });
        return created;
    });
}
async function listPurchaseReturns(scope, query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = {
        ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
        ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.purchaseReturn.findMany({
            where,
            include: {
                items: true,
                vendor: { select: { id: true, businessName: true } },
                retailer: { select: { id: true, storeName: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take,
        }),
        prisma_1.prisma.purchaseReturn.count({ where }),
    ]);
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
//# sourceMappingURL=purchase.service.js.map
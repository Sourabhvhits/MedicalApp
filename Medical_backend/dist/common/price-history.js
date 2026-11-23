"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPriceChanges = recordPriceChanges;
exports.listPriceHistory = listPriceHistory;
const prisma_1 = require("../database/prisma");
const money_1 = require("../utils/money");
const TRACKED_FIELDS = ['sellingPrice', 'purchasePrice', 'mrp', 'discountPct'];
/**
 * Records every price change so the platform keeps the audit history required
 * by business rule 19. Called after a catalog row is updated.
 */
async function recordPriceChanges(args) {
    const entries = TRACKED_FIELDS.flatMap((field) => {
        const previous = args.before[field];
        const next = args.after[field];
        if (next === undefined || next === null)
            return [];
        if (previous !== undefined && previous !== null && (0, money_1.D)(previous).equals((0, money_1.D)(next)))
            return [];
        return [
            {
                productId: args.productId,
                ownerType: args.ownerType,
                ownerId: args.ownerId,
                field,
                oldValue: previous === undefined || previous === null ? null : (0, money_1.D)(previous),
                newValue: (0, money_1.D)(next),
                changedById: args.changedById ?? null,
            },
        ];
    });
    if (entries.length > 0)
        await prisma_1.prisma.priceHistory.createMany({ data: entries });
}
async function listPriceHistory(ownerType, ownerId, productId) {
    return prisma_1.prisma.priceHistory.findMany({
        where: { ownerType, ownerId, productId },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
}
//# sourceMappingURL=price-history.js.map
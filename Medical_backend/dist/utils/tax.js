"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeLineTax = computeLineTax;
exports.aggregateTax = aggregateTax;
exports.isInterState = isInterState;
const money_1 = require("./money");
/**
 * Single source of truth for GST maths. Used by carts, customer orders,
 * purchase orders, sales and invoices so totals can never drift apart.
 */
function computeLineTax(input) {
    const qty = (0, money_1.D)(input.quantity);
    const gstRate = (0, money_1.D)(input.gstRate ?? 0);
    const discountPct = (0, money_1.D)(input.discountPct ?? 0);
    const gross = (0, money_1.round2)((0, money_1.D)(input.unitPrice).mul(qty));
    const discountAmount = (0, money_1.round2)(gross.mul(discountPct).div(100));
    const netAmount = gross.sub(discountAmount);
    let taxableAmount;
    let taxAmount;
    let totalAmount;
    if (input.priceIncludesTax) {
        taxableAmount = (0, money_1.round2)(netAmount.mul(100).div((0, money_1.D)(100).add(gstRate)));
        taxAmount = (0, money_1.round2)(netAmount.sub(taxableAmount));
        totalAmount = (0, money_1.round2)(netAmount);
    }
    else {
        taxableAmount = (0, money_1.round2)(netAmount);
        taxAmount = (0, money_1.round2)(taxableAmount.mul(gstRate).div(100));
        totalAmount = (0, money_1.round2)(taxableAmount.add(taxAmount));
    }
    const interState = input.interState ?? false;
    const half = (0, money_1.round2)(taxAmount.div(2));
    return {
        grossAmount: gross,
        discountAmount,
        taxableAmount,
        taxAmount,
        cgstAmount: interState ? (0, money_1.D)(0) : half,
        sgstAmount: interState ? (0, money_1.D)(0) : (0, money_1.round2)(taxAmount.sub(half)),
        igstAmount: interState ? taxAmount : (0, money_1.D)(0),
        totalAmount,
    };
}
function aggregateTax(lines) {
    const zero = (0, money_1.D)(0);
    return lines.reduce((acc, line) => ({
        subtotal: acc.subtotal.add(line.grossAmount),
        discountAmount: acc.discountAmount.add(line.discountAmount),
        taxableAmount: acc.taxableAmount.add(line.taxableAmount),
        taxAmount: acc.taxAmount.add(line.taxAmount),
        cgstAmount: acc.cgstAmount.add(line.cgstAmount),
        sgstAmount: acc.sgstAmount.add(line.sgstAmount),
        igstAmount: acc.igstAmount.add(line.igstAmount),
        totalAmount: acc.totalAmount.add(line.totalAmount),
    }), {
        subtotal: zero,
        discountAmount: zero,
        taxableAmount: zero,
        taxAmount: zero,
        cgstAmount: zero,
        sgstAmount: zero,
        igstAmount: zero,
        totalAmount: zero,
    });
}
/** GST is inter-state when the two GSTINs start with different state codes. */
function isInterState(sellerGst, buyerGst) {
    if (!sellerGst || !buyerGst || sellerGst.length < 2 || buyerGst.length < 2)
        return false;
    return sellerGst.slice(0, 2) !== buyerGst.slice(0, 2);
}
//# sourceMappingURL=tax.js.map
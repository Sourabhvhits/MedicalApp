"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextDocumentNumber = nextDocumentNumber;
exports.entityCode = entityCode;
exports.skuFromName = skuFromName;
const time_1 = require("./time");
const PREFIX = {
    order: 'ORD',
    purchaseOrder: 'PO',
    sale: 'SL',
    invoice: 'INV',
    payment: 'PAY',
    purchaseReturn: 'PR',
    salesReturn: 'SR',
};
/**
 * Human-readable document numbers, e.g. ORD-20260914-000123.
 * The daily counter is derived inside the caller's transaction so two
 * concurrent writers cannot produce the same number (the unique index on the
 * column is the final guard and the caller retries on conflict).
 */
async function nextDocumentNumber(tx, kind) {
    const prefix = PREFIX[kind];
    const stamp = (0, time_1.dayjs)().format('YYYYMMDD');
    const like = `${prefix}-${stamp}-%`;
    const counts = {
        order: () => tx.order.count({ where: { orderNumber: { startsWith: `${prefix}-${stamp}-` } } }),
        purchaseOrder: () => tx.purchaseOrder.count({ where: { poNumber: { startsWith: `${prefix}-${stamp}-` } } }),
        sale: () => tx.sale.count({ where: { saleNumber: { startsWith: `${prefix}-${stamp}-` } } }),
        invoice: () => tx.invoice.count({ where: { invoiceNumber: { startsWith: `${prefix}-${stamp}-` } } }),
        payment: () => tx.payment.count({ where: { paymentNumber: { startsWith: `${prefix}-${stamp}-` } } }),
        purchaseReturn: () => tx.purchaseReturn.count({ where: { returnNumber: { startsWith: `${prefix}-${stamp}-` } } }),
        salesReturn: () => tx.salesReturn.count({ where: { returnNumber: { startsWith: `${prefix}-${stamp}-` } } }),
    };
    void like;
    const used = await counts[kind]();
    return `${prefix}-${stamp}-${String(used + 1).padStart(6, '0')}`;
}
/** Short business codes such as VEN-000045 / RET-000012 / CUS-000101. */
function entityCode(prefix, sequence) {
    return `${prefix}-${String(sequence).padStart(6, '0')}`;
}
function skuFromName(name, sequence) {
    const letters = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || 'PROD';
    return `${letters}-${String(sequence).padStart(6, '0')}`;
}
//# sourceMappingURL=numbering.js.map
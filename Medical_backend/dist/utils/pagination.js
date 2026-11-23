"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPagination = getPagination;
exports.getSort = getSort;
const constants_1 = require("../config/constants");
function getPagination(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const rawLimit = Number(query.limit) || constants_1.DEFAULT_PAGE_SIZE;
    const limit = Math.min(Math.max(1, rawLimit), constants_1.MAX_PAGE_SIZE);
    return { page, limit, skip: (page - 1) * limit, take: limit };
}
function getSort(sortBy, sortOrder, allowed, fallback) {
    const field = allowed.includes(sortBy) ? sortBy : fallback;
    const order = sortOrder === 'asc' ? 'asc' : 'desc';
    return { field, order };
}
//# sourceMappingURL=pagination.js.map
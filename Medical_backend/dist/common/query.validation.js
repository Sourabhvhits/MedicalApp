"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportQuery = exports.dateRangeQuery = exports.approvalStatusEnum = exports.recordStatusEnum = exports.paginationQuery = exports.idParam = void 0;
const zod_1 = require("zod");
const constants_1 = require("../config/constants");
exports.idParam = zod_1.z.object({ id: zod_1.z.string().uuid('Invalid id') });
exports.paginationQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(constants_1.MAX_PAGE_SIZE).default(constants_1.DEFAULT_PAGE_SIZE),
    search: zod_1.z.string().trim().max(191).optional(),
    sortBy: zod_1.z.string().trim().max(40).optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
exports.recordStatusEnum = zod_1.z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']);
exports.approvalStatusEnum = zod_1.z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED']);
exports.dateRangeQuery = zod_1.z.object({
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
});
exports.exportQuery = zod_1.z.object({
    format: zod_1.z.enum(['json', 'csv', 'excel', 'pdf']).default('json'),
});
//# sourceMappingURL=query.validation.js.map
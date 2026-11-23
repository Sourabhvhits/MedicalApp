"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.masterRepository = masterRepository;
const prisma_1 = require("../database/prisma");
const ApiError_1 = require("../utils/ApiError");
const response_1 = require("../utils/response");
const pagination_1 = require("../utils/pagination");
/**
 * Shared list/get/create/update/delete implementation for the simple master
 * tables. Keeps pagination, search and soft-delete behaviour identical across
 * categories, sub-categories, manufacturers and units.
 */
function masterRepository(model, label) {
    // Prisma delegates share the same call signature for these operations.
    const delegate = prisma_1.prisma[model];
    const supportsSoftDelete = model !== 'productUnit';
    return {
        async list(options) {
            const { page, limit, skip, take } = (0, pagination_1.getPagination)(options.query);
            const search = options.query.search;
            const where = {
                ...(supportsSoftDelete ? { deletedAt: null } : {}),
                ...(options.where ?? {}),
            };
            if (search && options.searchFields?.length) {
                where.OR = options.searchFields.map((field) => ({ [field]: { contains: search } }));
            }
            const sortBy = options.query.sortBy;
            const allowed = options.allowedSort ?? ['createdAt', 'name'];
            const orderBy = {
                [allowed.includes(sortBy ?? '') ? sortBy : (options.defaultSort ?? 'createdAt')]: options.query.sortOrder === 'asc' ? 'asc' : 'desc',
            };
            const [items, total] = await Promise.all([
                delegate.findMany({ where, include: options.include, orderBy, skip, take }),
                delegate.count({ where }),
            ]);
            return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
        },
        async getById(id, include) {
            const record = await delegate.findFirst({
                where: { id, ...(supportsSoftDelete ? { deletedAt: null } : {}) },
                include,
            });
            if (!record)
                throw ApiError_1.ApiError.notFound(`${label} not found`);
            return record;
        },
        async create(data) {
            return delegate.create({ data });
        },
        async update(id, data) {
            await this.getById(id);
            return delegate.update({ where: { id }, data });
        },
        /** Soft-deletes where supported so historical records keep their references. */
        async remove(id) {
            await this.getById(id);
            if (supportsSoftDelete) {
                return delegate.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
            }
            return delegate.update({ where: { id }, data: { status: 'INACTIVE' } });
        },
    };
}
//# sourceMappingURL=crud.service.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProducts = listProducts;
exports.getProduct = getProduct;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
exports.setProductStatus = setProductStatus;
exports.setProductRecall = setProductRecall;
const prisma_1 = require("../../database/prisma");
const ApiError_1 = require("../../utils/ApiError");
const response_1 = require("../../utils/response");
const pagination_1 = require("../../utils/pagination");
const numbering_1 = require("../../utils/numbering");
const LIST_INCLUDE = {
    category: { select: { id: true, name: true } },
    subCategory: { select: { id: true, name: true } },
    manufacturer: { select: { id: true, name: true } },
    unit: { select: { id: true, name: true, code: true } },
};
const SORTABLE = ['name', 'mrp', 'createdAt', 'updatedAt'];
function buildWhere(query) {
    const where = { deletedAt: null };
    if (query.status)
        where.status = query.status;
    if (query.categoryId)
        where.categoryId = query.categoryId;
    if (query.subCategoryId)
        where.subCategoryId = query.subCategoryId;
    if (query.manufacturerId)
        where.manufacturerId = query.manufacturerId;
    if (query.prescriptionRequired !== undefined)
        where.prescriptionRequired = query.prescriptionRequired;
    if (query.minMrp !== undefined || query.maxMrp !== undefined) {
        where.mrp = {
            ...(query.minMrp !== undefined ? { gte: query.minMrp } : {}),
            ...(query.maxMrp !== undefined ? { lte: query.maxMrp } : {}),
        };
    }
    if (query.search) {
        // Indexed prefix-friendly search across the fields a pharmacist would type.
        where.OR = [
            { name: { contains: query.search } },
            { genericName: { contains: query.search } },
            { brandName: { contains: query.search } },
            { composition: { contains: query.search } },
            { sku: { contains: query.search } },
            { searchKeywords: { contains: query.search } },
        ];
    }
    return where;
}
async function listProducts(query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = buildWhere(query);
    const sortBy = SORTABLE.includes(query.sortBy ?? '')
        ? query.sortBy
        : 'createdAt';
    const [items, total] = await Promise.all([
        prisma_1.prisma.product.findMany({
            where,
            include: LIST_INCLUDE,
            orderBy: { [sortBy]: query.sortOrder },
            skip,
            take,
        }),
        prisma_1.prisma.product.count({ where }),
    ]);
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
async function getProduct(id) {
    const product = await prisma_1.prisma.product.findFirst({
        where: { id, deletedAt: null },
        include: {
            ...LIST_INCLUDE,
            _count: { select: { vendorProducts: true, retailerProducts: true } },
        },
    });
    if (!product)
        throw ApiError_1.ApiError.notFound('Product not found');
    return product;
}
/** Validates that every referenced master row exists and is usable. */
async function assertReferences(data) {
    if (data.categoryId) {
        const category = await prisma_1.prisma.category.findFirst({
            where: { id: data.categoryId, deletedAt: null },
            select: { id: true },
        });
        if (!category)
            throw ApiError_1.ApiError.badRequest('Category not found');
    }
    if (data.subCategoryId) {
        const sub = await prisma_1.prisma.subCategory.findFirst({
            where: { id: data.subCategoryId, deletedAt: null },
            select: { categoryId: true },
        });
        if (!sub)
            throw ApiError_1.ApiError.badRequest('Sub category not found');
        if (data.categoryId && sub.categoryId !== data.categoryId) {
            throw ApiError_1.ApiError.badRequest('Sub category does not belong to the selected category');
        }
    }
    if (data.manufacturerId) {
        const manufacturer = await prisma_1.prisma.manufacturer.findFirst({
            where: { id: data.manufacturerId, deletedAt: null },
            select: { id: true },
        });
        if (!manufacturer)
            throw ApiError_1.ApiError.badRequest('Manufacturer not found');
    }
    if (data.unitId) {
        const unit = await prisma_1.prisma.productUnit.findUnique({ where: { id: data.unitId }, select: { id: true } });
        if (!unit)
            throw ApiError_1.ApiError.badRequest('Unit not found');
    }
}
/**
 * Guards against duplicate master products — the catalogue is centralised, so
 * the same brand + strength + pack must not be entered twice.
 */
async function assertNotDuplicate(data, excludeId) {
    const duplicate = await prisma_1.prisma.product.findFirst({
        where: {
            deletedAt: null,
            name: data.name,
            brandName: data.brandName ?? null,
            strength: data.strength ?? null,
            packSize: data.packSize ?? null,
            ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, sku: true },
    });
    if (duplicate) {
        throw ApiError_1.ApiError.conflict(`This product already exists in the master catalogue (SKU ${duplicate.sku}). Use the existing product instead of creating a duplicate.`);
    }
}
async function createProduct(data, createdById) {
    await assertReferences(data);
    await assertNotDuplicate(data);
    let sku = data.sku?.toUpperCase();
    if (sku) {
        const existing = await prisma_1.prisma.product.findUnique({ where: { sku }, select: { id: true } });
        if (existing)
            throw ApiError_1.ApiError.conflict('A product with this SKU already exists');
    }
    else {
        const sequence = await prisma_1.prisma.product.count();
        sku = (0, numbering_1.skuFromName)(data.name, sequence + 1);
        // The generated SKU can collide after deletes — walk forward until it is free.
        let attempt = sequence + 1;
        while (await prisma_1.prisma.product.findUnique({ where: { sku }, select: { id: true } })) {
            attempt += 1;
            sku = (0, numbering_1.skuFromName)(data.name, attempt);
        }
    }
    return prisma_1.prisma.product.create({
        data: {
            ...data,
            sku,
            createdById: createdById ?? null,
            searchKeywords: [data.name, data.genericName, data.brandName].filter(Boolean).join(' ').slice(0, 500),
        },
        include: LIST_INCLUDE,
    });
}
async function updateProduct(id, data) {
    const current = await getProduct(id);
    await assertReferences(data);
    if (data.name || data.brandName || data.strength || data.packSize) {
        await assertNotDuplicate({
            ...current,
            ...data,
            name: data.name ?? current.name,
            brandName: data.brandName ?? current.brandName ?? undefined,
            strength: data.strength ?? current.strength ?? undefined,
            packSize: data.packSize ?? current.packSize ?? undefined,
        }, id);
    }
    const name = data.name ?? current.name;
    const genericName = data.genericName ?? current.genericName;
    const brandName = data.brandName ?? current.brandName;
    return prisma_1.prisma.product.update({
        where: { id },
        data: {
            ...data,
            searchKeywords: [name, genericName, brandName].filter(Boolean).join(' ').slice(0, 500),
        },
        include: LIST_INCLUDE,
    });
}
/**
 * Soft-deletes a product. Vendor and retailer catalog rows are deactivated so
 * the product disappears from storefronts without breaking order history.
 */
async function deleteProduct(id) {
    await getProduct(id);
    return prisma_1.prisma.$transaction(async (tx) => {
        await tx.vendorProduct.updateMany({ where: { productId: id }, data: { status: 'INACTIVE' } });
        await tx.retailerProduct.updateMany({ where: { productId: id }, data: { status: 'INACTIVE' } });
        return tx.product.update({
            where: { id },
            data: { deletedAt: new Date(), status: 'INACTIVE' },
        });
    });
}
async function setProductStatus(id, status) {
    await getProduct(id);
    return prisma_1.prisma.$transaction(async (tx) => {
        // Blocking a product must immediately remove it from every storefront.
        if (status === 'BLOCKED') {
            await tx.vendorProduct.updateMany({ where: { productId: id }, data: { status: 'BLOCKED' } });
            await tx.retailerProduct.updateMany({ where: { productId: id }, data: { status: 'BLOCKED' } });
        }
        return tx.product.update({ where: { id }, data: { status }, include: LIST_INCLUDE });
    });
}
async function setProductRecall(id, isRecalled, reason) {
    await getProduct(id);
    return prisma_1.prisma.$transaction(async (tx) => {
        if (isRecalled) {
            await tx.vendorProduct.updateMany({ where: { productId: id }, data: { status: 'BLOCKED' } });
            await tx.retailerProduct.updateMany({ where: { productId: id }, data: { status: 'BLOCKED' } });
            await tx.inventoryBatch.updateMany({ where: { productId: id }, data: { status: 'BLOCKED' } });
        }
        return tx.product.update({
            where: { id },
            data: {
                isRecalled,
                recallReason: isRecalled ? (reason ?? null) : null,
                status: isRecalled ? 'BLOCKED' : 'ACTIVE',
            },
            include: LIST_INCLUDE,
        });
    });
}
//# sourceMappingURL=product.service.js.map
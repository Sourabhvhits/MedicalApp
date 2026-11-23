"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnit = exports.getManufacturer = exports.getSubCategory = exports.getCategory = void 0;
exports.listCategories = listCategories;
exports.createCategory = createCategory;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
exports.listSubCategories = listSubCategories;
exports.createSubCategory = createSubCategory;
exports.updateSubCategory = updateSubCategory;
exports.deleteSubCategory = deleteSubCategory;
exports.listManufacturers = listManufacturers;
exports.createManufacturer = createManufacturer;
exports.updateManufacturer = updateManufacturer;
exports.deleteManufacturer = deleteManufacturer;
exports.listUnits = listUnits;
exports.createUnit = createUnit;
exports.updateUnit = updateUnit;
exports.deleteUnit = deleteUnit;
const prisma_1 = require("../../database/prisma");
const ApiError_1 = require("../../utils/ApiError");
const slug_1 = require("../../utils/slug");
const crud_service_1 = require("../../common/crud.service");
const redis_1 = require("../../lib/redis");
const categoryRepo = (0, crud_service_1.masterRepository)('category', 'Category');
const subCategoryRepo = (0, crud_service_1.masterRepository)('subCategory', 'Sub category');
const manufacturerRepo = (0, crud_service_1.masterRepository)('manufacturer', 'Manufacturer');
const unitRepo = (0, crud_service_1.masterRepository)('productUnit', 'Unit');
const bustMasterCache = () => (0, redis_1.invalidate)('masters:*');
// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
async function listCategories(query) {
    return categoryRepo.list({
        query,
        where: query.status ? { status: query.status } : {},
        include: query.withSubCategories
            ? { subCategories: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } }
            : { _count: { select: { products: true, subCategories: true } } },
        searchFields: ['name', 'description'],
        defaultSort: 'sortOrder',
        allowedSort: ['sortOrder', 'name', 'createdAt'],
    });
}
const getCategory = (id) => categoryRepo.getById(id, {
    subCategories: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
    _count: { select: { products: true } },
});
exports.getCategory = getCategory;
async function createCategory(data) {
    const slug = await (0, slug_1.uniqueSlug)(String(data.name), async (candidate) => Boolean(await prisma_1.prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } })));
    const created = await categoryRepo.create({ ...data, slug });
    await bustMasterCache();
    return created;
}
async function updateCategory(id, data) {
    const payload = { ...data };
    if (data.name) {
        payload.slug = await (0, slug_1.uniqueSlug)(String(data.name), async (candidate) => {
            const existing = await prisma_1.prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } });
            return Boolean(existing && existing.id !== id);
        });
    }
    const updated = await categoryRepo.update(id, payload);
    await bustMasterCache();
    return updated;
}
async function deleteCategory(id) {
    const productCount = await prisma_1.prisma.product.count({ where: { categoryId: id, deletedAt: null } });
    if (productCount > 0) {
        throw ApiError_1.ApiError.badRequest(`This category has ${productCount} product(s). Move or remove them before deleting.`);
    }
    const removed = await categoryRepo.remove(id);
    await bustMasterCache();
    return removed;
}
// ---------------------------------------------------------------------------
// Sub categories
// ---------------------------------------------------------------------------
async function listSubCategories(query) {
    return subCategoryRepo.list({
        query,
        where: {
            ...(query.status ? { status: query.status } : {}),
            ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        },
        include: {
            category: { select: { id: true, name: true } },
            _count: { select: { products: true } },
        },
        searchFields: ['name'],
        defaultSort: 'sortOrder',
        allowedSort: ['sortOrder', 'name', 'createdAt'],
    });
}
const getSubCategory = (id) => subCategoryRepo.getById(id, { category: { select: { id: true, name: true } } });
exports.getSubCategory = getSubCategory;
async function createSubCategory(data) {
    const category = await prisma_1.prisma.category.findFirst({
        where: { id: String(data.categoryId), deletedAt: null },
        select: { id: true, name: true },
    });
    if (!category)
        throw ApiError_1.ApiError.badRequest('Parent category not found');
    const slug = await (0, slug_1.uniqueSlug)(`${category.name}-${data.name}`, async (candidate) => Boolean(await prisma_1.prisma.subCategory.findUnique({ where: { slug: candidate }, select: { id: true } })));
    const created = await subCategoryRepo.create({ ...data, slug });
    await bustMasterCache();
    return created;
}
async function updateSubCategory(id, data) {
    const payload = { ...data };
    if (data.name) {
        const current = (await subCategoryRepo.getById(id, { category: true }));
        payload.slug = await (0, slug_1.uniqueSlug)(`${current.category.name}-${data.name}`, async (candidate) => {
            const existing = await prisma_1.prisma.subCategory.findUnique({ where: { slug: candidate }, select: { id: true } });
            return Boolean(existing && existing.id !== id);
        });
    }
    const updated = await subCategoryRepo.update(id, payload);
    await bustMasterCache();
    return updated;
}
async function deleteSubCategory(id) {
    const productCount = await prisma_1.prisma.product.count({ where: { subCategoryId: id, deletedAt: null } });
    if (productCount > 0) {
        throw ApiError_1.ApiError.badRequest(`This sub category has ${productCount} product(s) attached.`);
    }
    const removed = await subCategoryRepo.remove(id);
    await bustMasterCache();
    return removed;
}
// ---------------------------------------------------------------------------
// Manufacturers
// ---------------------------------------------------------------------------
async function listManufacturers(query) {
    return manufacturerRepo.list({
        query,
        where: query.status ? { status: query.status } : {},
        include: { _count: { select: { products: true } } },
        searchFields: ['name', 'code', 'city', 'gstNumber'],
        defaultSort: 'name',
        allowedSort: ['name', 'code', 'createdAt'],
    });
}
const getManufacturer = (id) => manufacturerRepo.getById(id, { _count: { select: { products: true } } });
exports.getManufacturer = getManufacturer;
async function createManufacturer(data) {
    const code = String(data.code ?? (0, slug_1.slugify)(String(data.name)).toUpperCase()).toUpperCase();
    const existing = await prisma_1.prisma.manufacturer.findUnique({ where: { code }, select: { id: true } });
    if (existing)
        throw ApiError_1.ApiError.conflict('A manufacturer with this code already exists');
    const created = await manufacturerRepo.create({ ...data, code });
    await bustMasterCache();
    return created;
}
async function updateManufacturer(id, data) {
    if (data.code) {
        const code = String(data.code).toUpperCase();
        const existing = await prisma_1.prisma.manufacturer.findUnique({ where: { code }, select: { id: true } });
        if (existing && existing.id !== id)
            throw ApiError_1.ApiError.conflict('A manufacturer with this code already exists');
        data.code = code;
    }
    const updated = await manufacturerRepo.update(id, data);
    await bustMasterCache();
    return updated;
}
async function deleteManufacturer(id) {
    const productCount = await prisma_1.prisma.product.count({ where: { manufacturerId: id, deletedAt: null } });
    if (productCount > 0) {
        throw ApiError_1.ApiError.badRequest(`This manufacturer has ${productCount} product(s) attached.`);
    }
    const removed = await manufacturerRepo.remove(id);
    await bustMasterCache();
    return removed;
}
// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------
async function listUnits(query) {
    return unitRepo.list({
        query,
        where: query.status ? { status: query.status } : {},
        searchFields: ['name', 'code'],
        defaultSort: 'name',
        allowedSort: ['name', 'code', 'createdAt'],
    });
}
const getUnit = (id) => unitRepo.getById(id);
exports.getUnit = getUnit;
async function createUnit(data) {
    const code = String(data.code).toUpperCase();
    const existing = await prisma_1.prisma.productUnit.findUnique({ where: { code }, select: { id: true } });
    if (existing)
        throw ApiError_1.ApiError.conflict('A unit with this code already exists');
    const created = await unitRepo.create({ ...data, code });
    await bustMasterCache();
    return created;
}
async function updateUnit(id, data) {
    if (data.code) {
        const code = String(data.code).toUpperCase();
        const existing = await prisma_1.prisma.productUnit.findUnique({ where: { code }, select: { id: true } });
        if (existing && existing.id !== id)
            throw ApiError_1.ApiError.conflict('A unit with this code already exists');
        data.code = code;
    }
    const updated = await unitRepo.update(id, data);
    await bustMasterCache();
    return updated;
}
async function deleteUnit(id) {
    const productCount = await prisma_1.prisma.product.count({ where: { unitId: id, deletedAt: null } });
    if (productCount > 0)
        throw ApiError_1.ApiError.badRequest(`This unit is used by ${productCount} product(s).`);
    const removed = await unitRepo.remove(id);
    await bustMasterCache();
    return removed;
}
//# sourceMappingURL=masters.service.js.map
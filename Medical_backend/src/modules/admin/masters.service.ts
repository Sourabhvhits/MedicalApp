import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { slugify, uniqueSlug } from '../../utils/slug';
import { masterRepository } from '../../common/crud.service';
import { invalidate } from '../../lib/redis';
import { buildMeta } from '../../utils/response';
import { getPagination } from '../../utils/pagination';

const categoryRepo = masterRepository('category', 'Category');
const subCategoryRepo = masterRepository('subCategory', 'Sub category');
const manufacturerRepo = masterRepository('manufacturer', 'Manufacturer');
const unitRepo = masterRepository('productUnit', 'Unit');

const bustMasterCache = () => invalidate('masters:*');

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories(query: Record<string, unknown>) {
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

export const getCategory = (id: string) =>
  categoryRepo.getById(id, {
    subCategories: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
    _count: { select: { products: true } },
  });

export async function createCategory(data: Record<string, unknown>) {
  const slug = await uniqueSlug(String(data.name), async (candidate) =>
    Boolean(await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );
  const created = await categoryRepo.create({ ...data, slug });
  await bustMasterCache();
  return created;
}

export async function updateCategory(id: string, data: Record<string, unknown>) {
  const payload = { ...data };
  if (data.name) {
    payload.slug = await uniqueSlug(String(data.name), async (candidate) => {
      const existing = await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } });
      return Boolean(existing && existing.id !== id);
    });
  }
  const updated = await categoryRepo.update(id, payload);
  await bustMasterCache();
  return updated;
}

export async function deleteCategory(id: string) {
  const productCount = await prisma.product.count({ where: { categoryId: id, deletedAt: null } });
  if (productCount > 0) {
    throw ApiError.badRequest(
      `This category has ${productCount} product(s). Move or remove them before deleting.`,
    );
  }
  const removed = await categoryRepo.remove(id);
  await bustMasterCache();
  return removed;
}

// ---------------------------------------------------------------------------
// Sub categories
// ---------------------------------------------------------------------------

export async function listSubCategories(query: Record<string, unknown>) {
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

export const getSubCategory = (id: string) =>
  subCategoryRepo.getById(id, { category: { select: { id: true, name: true } } });

export async function createSubCategory(data: Record<string, unknown>) {
  const category = await prisma.category.findFirst({
    where: { id: String(data.categoryId), deletedAt: null },
    select: { id: true, name: true },
  });
  if (!category) throw ApiError.badRequest('Parent category not found');

  const slug = await uniqueSlug(`${category.name}-${data.name}`, async (candidate) =>
    Boolean(await prisma.subCategory.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );
  const created = await subCategoryRepo.create({ ...data, slug });
  await bustMasterCache();
  return created;
}

export async function updateSubCategory(id: string, data: Record<string, unknown>) {
  const payload = { ...data };
  if (data.name) {
    const current = (await subCategoryRepo.getById(id, { category: true })) as {
      category: { name: string };
    };
    payload.slug = await uniqueSlug(`${current.category.name}-${data.name}`, async (candidate) => {
      const existing = await prisma.subCategory.findUnique({ where: { slug: candidate }, select: { id: true } });
      return Boolean(existing && existing.id !== id);
    });
  }
  const updated = await subCategoryRepo.update(id, payload);
  await bustMasterCache();
  return updated;
}

export async function deleteSubCategory(id: string) {
  const productCount = await prisma.product.count({ where: { subCategoryId: id, deletedAt: null } });
  if (productCount > 0) {
    throw ApiError.badRequest(`This sub category has ${productCount} product(s) attached.`);
  }
  const removed = await subCategoryRepo.remove(id);
  await bustMasterCache();
  return removed;
}

// ---------------------------------------------------------------------------
// Manufacturers
// ---------------------------------------------------------------------------

export async function listManufacturers(query: Record<string, unknown>) {
  return manufacturerRepo.list({
    query,
    where: query.status ? { status: query.status } : {},
    include: { _count: { select: { products: true } } },
    searchFields: ['name', 'code', 'city', 'gstNumber'],
    defaultSort: 'name',
    allowedSort: ['name', 'code', 'createdAt'],
  });
}

export const getManufacturer = (id: string) =>
  manufacturerRepo.getById(id, { _count: { select: { products: true } } });

export async function createManufacturer(data: Record<string, unknown>) {
  const code = String(data.code ?? slugify(String(data.name)).toUpperCase()).toUpperCase();
  const existing = await prisma.manufacturer.findUnique({ where: { code }, select: { id: true } });
  if (existing) throw ApiError.conflict('A manufacturer with this code already exists');

  const created = await manufacturerRepo.create({ ...data, code });
  await bustMasterCache();
  return created;
}

export async function updateManufacturer(id: string, data: Record<string, unknown>) {
  if (data.code) {
    const code = String(data.code).toUpperCase();
    const existing = await prisma.manufacturer.findUnique({ where: { code }, select: { id: true } });
    if (existing && existing.id !== id) throw ApiError.conflict('A manufacturer with this code already exists');
    data.code = code;
  }
  const updated = await manufacturerRepo.update(id, data);
  await bustMasterCache();
  return updated;
}

export async function deleteManufacturer(id: string) {
  const productCount = await prisma.product.count({ where: { manufacturerId: id, deletedAt: null } });
  if (productCount > 0) {
    throw ApiError.badRequest(`This manufacturer has ${productCount} product(s) attached.`);
  }
  const removed = await manufacturerRepo.remove(id);
  await bustMasterCache();
  return removed;
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export async function listUnits(query: Record<string, unknown>) {
  return unitRepo.list({
    query,
    where: query.status ? { status: query.status } : {},
    searchFields: ['name', 'code'],
    defaultSort: 'name',
    allowedSort: ['name', 'code', 'createdAt'],
  });
}

export const getUnit = (id: string) => unitRepo.getById(id);

export async function createUnit(data: Record<string, unknown>) {
  const code = String(data.code).toUpperCase();
  const existing = await prisma.productUnit.findUnique({ where: { code }, select: { id: true } });
  if (existing) throw ApiError.conflict('A unit with this code already exists');
  const created = await unitRepo.create({ ...data, code });
  await bustMasterCache();
  return created;
}

export async function updateUnit(id: string, data: Record<string, unknown>) {
  if (data.code) {
    const code = String(data.code).toUpperCase();
    const existing = await prisma.productUnit.findUnique({ where: { code }, select: { id: true } });
    if (existing && existing.id !== id) throw ApiError.conflict('A unit with this code already exists');
    data.code = code;
  }
  const updated = await unitRepo.update(id, data);
  await bustMasterCache();
  return updated;
}

export async function deleteUnit(id: string) {
  const productCount = await prisma.product.count({ where: { unitId: id, deletedAt: null } });
  if (productCount > 0) throw ApiError.badRequest(`This unit is used by ${productCount} product(s).`);
  const removed = await unitRepo.remove(id);
  await bustMasterCache();
  return removed;
}

// ---------------------------------------------------------------------------
// Drug interactions (TASKS.md Priority-1 addition A) — a plain reference
// table, not a soft-deletable master, so this doesn't go through
// `masterRepository`.
// ---------------------------------------------------------------------------

/** Alphabetical order so `[A, B]` and `[B, A]` always collide on the unique index. */
function normalizeInteractionPair(a: string, b: string): [string, string] {
  return a.trim().toLowerCase() <= b.trim().toLowerCase() ? [a.trim(), b.trim()] : [b.trim(), a.trim()];
}

export async function listDrugInteractions(query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);
  const search = query.search as string | undefined;

  const where = {
    ...(query.severity ? { severity: query.severity } : {}),
    ...(search
      ? { OR: [{ compositionA: { contains: search } }, { compositionB: { contains: search } }] }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.drugInteraction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.drugInteraction.count({ where }),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getDrugInteraction(id: string) {
  const row = await prisma.drugInteraction.findUnique({ where: { id } });
  if (!row) throw ApiError.notFound('Drug interaction not found');
  return row;
}

export async function createDrugInteraction(data: Record<string, unknown>) {
  const [compositionA, compositionB] = normalizeInteractionPair(
    String(data.compositionA),
    String(data.compositionB),
  );
  const existing = await prisma.drugInteraction.findUnique({
    where: { compositionA_compositionB: { compositionA, compositionB } },
  });
  if (existing) throw ApiError.conflict('An interaction between these two compositions already exists');

  return prisma.drugInteraction.create({
    data: { ...data, compositionA, compositionB } as Prisma.DrugInteractionCreateInput,
  });
}

export async function updateDrugInteraction(id: string, data: Record<string, unknown>) {
  await getDrugInteraction(id);
  const payload = { ...data };
  if (data.compositionA || data.compositionB) {
    const current = await getDrugInteraction(id);
    const [compositionA, compositionB] = normalizeInteractionPair(
      String(data.compositionA ?? current.compositionA),
      String(data.compositionB ?? current.compositionB),
    );
    payload.compositionA = compositionA;
    payload.compositionB = compositionB;
  }
  return prisma.drugInteraction.update({ where: { id }, data: payload as Prisma.DrugInteractionUpdateInput });
}

export async function deleteDrugInteraction(id: string) {
  const removed = await getDrugInteraction(id);
  await prisma.drugInteraction.delete({ where: { id } });
  return removed;
}

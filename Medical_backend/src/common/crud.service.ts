import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';
import { ApiError } from '../utils/ApiError';
import { buildMeta } from '../utils/response';
import { getPagination } from '../utils/pagination';

type DelegateName = 'category' | 'subCategory' | 'manufacturer' | 'productUnit';

interface ListOptions {
  query: Record<string, unknown>;
  where?: Prisma.CategoryWhereInput | Record<string, unknown>;
  include?: Record<string, unknown>;
  searchFields?: string[];
  defaultSort?: string;
  allowedSort?: readonly string[];
}

/**
 * Shared list/get/create/update/delete implementation for the simple master
 * tables. Keeps pagination, search and soft-delete behaviour identical across
 * categories, sub-categories, manufacturers and units.
 */
export function masterRepository(model: DelegateName, label: string) {
  // Prisma delegates share the same call signature for these operations.
  const delegate = prisma[model] as unknown as {
    findMany: (args: unknown) => Promise<unknown[]>;
    count: (args: unknown) => Promise<number>;
    findFirst: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };

  const supportsSoftDelete = model !== 'productUnit';

  return {
    async list(options: ListOptions) {
      const { page, limit, skip, take } = getPagination(options.query);
      const search = options.query.search as string | undefined;

      const where: Record<string, unknown> = {
        ...(supportsSoftDelete ? { deletedAt: null } : {}),
        ...(options.where ?? {}),
      };

      if (search && options.searchFields?.length) {
        where.OR = options.searchFields.map((field) => ({ [field]: { contains: search } }));
      }

      const sortBy = options.query.sortBy as string | undefined;
      const allowed = options.allowedSort ?? ['createdAt', 'name'];
      const orderBy = {
        [allowed.includes(sortBy ?? '') ? sortBy! : (options.defaultSort ?? 'createdAt')]:
          options.query.sortOrder === 'asc' ? 'asc' : 'desc',
      };

      const [items, total] = await Promise.all([
        delegate.findMany({ where, include: options.include, orderBy, skip, take }),
        delegate.count({ where }),
      ]);

      return { items, meta: buildMeta(page, limit, total) };
    },

    async getById(id: string, include?: Record<string, unknown>) {
      const record = await delegate.findFirst({
        where: { id, ...(supportsSoftDelete ? { deletedAt: null } : {}) },
        include,
      });
      if (!record) throw ApiError.notFound(`${label} not found`);
      return record;
    },

    async create(data: Record<string, unknown>) {
      return delegate.create({ data });
    },

    async update(id: string, data: Record<string, unknown>) {
      await this.getById(id);
      return delegate.update({ where: { id }, data });
    },

    /** Soft-deletes where supported so historical records keep their references. */
    async remove(id: string) {
      await this.getById(id);
      if (supportsSoftDelete) {
        return delegate.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
      }
      return delegate.update({ where: { id }, data: { status: 'INACTIVE' } });
    },
  };
}

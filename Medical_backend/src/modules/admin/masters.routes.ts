import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, noContent, ok, paginated } from '../../utils/response';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/rbac';
import { auditFromRequest } from '../../lib/audit';
import { AUDIT_MODULES } from '../../config/constants';
import { PERMISSIONS } from '../../config/permissions';
import { idParam } from '../../common/query.validation';
import { doc } from '../../lib/openapi';
import * as service from './masters.service';
import {
  categoryCreateSchema,
  categoryListQuery,
  categoryUpdateSchema,
  drugInteractionCreateSchema,
  drugInteractionListQuery,
  drugInteractionUpdateSchema,
  manufacturerCreateSchema,
  manufacturerListQuery,
  manufacturerUpdateSchema,
  subCategoryCreateSchema,
  subCategoryListQuery,
  subCategoryUpdateSchema,
  unitCreateSchema,
  unitListQuery,
  unitUpdateSchema,
} from './masters.validation';

const router = Router();

interface ResourceConfig {
  path: string;
  label: string;
  tag: string;
  viewPermission: string;
  managePermission: string;
  schemas: {
    list: typeof categoryListQuery;
    create: typeof categoryCreateSchema;
    update: typeof categoryUpdateSchema;
  };
  handlers: {
    list: (query: Record<string, unknown>) => Promise<{ items: unknown[]; meta: never }>;
    get: (id: string) => Promise<unknown>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    update: (id: string, data: Record<string, unknown>) => Promise<unknown>;
    remove: (id: string) => Promise<unknown>;
  };
}

/**
 * Mounts the identical five endpoints each master resource needs, so the
 * validation, RBAC, audit and response shape stay consistent across them.
 */
function mountResource(config: ResourceConfig): void {
  const { path, label, handlers, schemas } = config;

  router.get(
    path,
    requirePermission(config.viewPermission),
    validate({ query: schemas.list }),
    asyncHandler(async (req, res) => {
      const { items, meta } = await handlers.list(req.query as Record<string, unknown>);
      return paginated(res, items, meta);
    }),
  );

  router.get(
    `${path}/:id`,
    requirePermission(config.viewPermission),
    validate({ params: idParam }),
    asyncHandler(async (req, res) => ok(res, await handlers.get(req.params.id))),
  );

  router.post(
    path,
    requirePermission(config.managePermission),
    validate({ body: schemas.create }),
    asyncHandler(async (req, res) => {
      const record = await handlers.create(req.body);
      await auditFromRequest(req, {
        action: `${label.toLowerCase()}.create`,
        module: AUDIT_MODULES.PRODUCT,
        recordId: (record as { id: string }).id,
        newValue: record,
      });
      return created(res, record, `${label} created`);
    }),
  );

  router.put(
    `${path}/:id`,
    requirePermission(config.managePermission),
    validate({ params: idParam, body: schemas.update }),
    asyncHandler(async (req, res) => {
      const before = await handlers.get(req.params.id);
      const record = await handlers.update(req.params.id, req.body);
      await auditFromRequest(req, {
        action: `${label.toLowerCase()}.update`,
        module: AUDIT_MODULES.PRODUCT,
        recordId: req.params.id,
        oldValue: before,
        newValue: record,
      });
      return ok(res, record, `${label} updated`);
    }),
  );

  router.delete(
    `${path}/:id`,
    requirePermission(config.managePermission),
    validate({ params: idParam }),
    asyncHandler(async (req, res) => {
      const record = await handlers.remove(req.params.id);
      await auditFromRequest(req, {
        action: `${label.toLowerCase()}.delete`,
        module: AUDIT_MODULES.PRODUCT,
        recordId: req.params.id,
        oldValue: record,
      });
      return noContent(res, `${label} deleted`);
    }),
  );

  doc('get', `/admin${path}`, { tags: [config.tag], summary: `List ${label.toLowerCase()}s`, query: schemas.list, paginated: true });
  doc('get', `/admin${path}/{id}`, { tags: [config.tag], summary: `Get ${label.toLowerCase()}`, params: idParam });
  doc('post', `/admin${path}`, { tags: [config.tag], summary: `Create ${label.toLowerCase()}`, body: schemas.create });
  doc('put', `/admin${path}/{id}`, { tags: [config.tag], summary: `Update ${label.toLowerCase()}`, params: idParam, body: schemas.update });
  doc('delete', `/admin${path}/{id}`, { tags: [config.tag], summary: `Delete ${label.toLowerCase()}`, params: idParam });
}

mountResource({
  path: '/categories',
  label: 'Category',
  tag: 'Admin Masters',
  viewPermission: PERMISSIONS.CATEGORY_VIEW,
  managePermission: PERMISSIONS.CATEGORY_MANAGE,
  schemas: { list: categoryListQuery, create: categoryCreateSchema, update: categoryUpdateSchema },
  handlers: {
    list: service.listCategories as never,
    get: service.getCategory,
    create: service.createCategory,
    update: service.updateCategory,
    remove: service.deleteCategory,
  },
});

mountResource({
  path: '/sub-categories',
  label: 'Sub category',
  tag: 'Admin Masters',
  viewPermission: PERMISSIONS.CATEGORY_VIEW,
  managePermission: PERMISSIONS.CATEGORY_MANAGE,
  schemas: {
    list: subCategoryListQuery as never,
    create: subCategoryCreateSchema as never,
    update: subCategoryUpdateSchema as never,
  },
  handlers: {
    list: service.listSubCategories as never,
    get: service.getSubCategory,
    create: service.createSubCategory,
    update: service.updateSubCategory,
    remove: service.deleteSubCategory,
  },
});

mountResource({
  path: '/manufacturers',
  label: 'Manufacturer',
  tag: 'Admin Masters',
  viewPermission: PERMISSIONS.MANUFACTURER_VIEW,
  managePermission: PERMISSIONS.MANUFACTURER_MANAGE,
  schemas: {
    list: manufacturerListQuery as never,
    create: manufacturerCreateSchema as never,
    update: manufacturerUpdateSchema as never,
  },
  handlers: {
    list: service.listManufacturers as never,
    get: service.getManufacturer,
    create: service.createManufacturer,
    update: service.updateManufacturer,
    remove: service.deleteManufacturer,
  },
});

mountResource({
  path: '/units',
  label: 'Unit',
  tag: 'Admin Masters',
  viewPermission: PERMISSIONS.UNIT_VIEW,
  managePermission: PERMISSIONS.UNIT_MANAGE,
  schemas: {
    list: unitListQuery as never,
    create: unitCreateSchema as never,
    update: unitUpdateSchema as never,
  },
  handlers: {
    list: service.listUnits as never,
    get: service.getUnit,
    create: service.createUnit,
    update: service.updateUnit,
    remove: service.deleteUnit,
  },
});

mountResource({
  path: '/drug-interactions',
  label: 'Drug interaction',
  tag: 'Admin Masters',
  viewPermission: PERMISSIONS.DRUG_INTERACTION_VIEW,
  managePermission: PERMISSIONS.DRUG_INTERACTION_MANAGE,
  schemas: {
    list: drugInteractionListQuery as never,
    create: drugInteractionCreateSchema as never,
    update: drugInteractionUpdateSchema as never,
  },
  handlers: {
    list: service.listDrugInteractions as never,
    get: service.getDrugInteraction,
    create: service.createDrugInteraction,
    update: service.updateDrugInteraction,
    remove: service.deleteDrugInteraction,
  },
});

export default router;

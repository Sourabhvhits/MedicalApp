"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const validate_1 = require("../../middleware/validate");
const rbac_1 = require("../../middleware/rbac");
const audit_1 = require("../../lib/audit");
const constants_1 = require("../../config/constants");
const permissions_1 = require("../../config/permissions");
const query_validation_1 = require("../../common/query.validation");
const openapi_1 = require("../../lib/openapi");
const service = __importStar(require("./masters.service"));
const masters_validation_1 = require("./masters.validation");
const router = (0, express_1.Router)();
/**
 * Mounts the identical five endpoints each master resource needs, so the
 * validation, RBAC, audit and response shape stay consistent across them.
 */
function mountResource(config) {
    const { path, label, handlers, schemas } = config;
    router.get(path, (0, rbac_1.requirePermission)(config.viewPermission), (0, validate_1.validate)({ query: schemas.list }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const { items, meta } = await handlers.list(req.query);
        return (0, response_1.paginated)(res, items, meta);
    }));
    router.get(`${path}/:id`, (0, rbac_1.requirePermission)(config.viewPermission), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await handlers.get(req.params.id))));
    router.post(path, (0, rbac_1.requirePermission)(config.managePermission), (0, validate_1.validate)({ body: schemas.create }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const record = await handlers.create(req.body);
        await (0, audit_1.auditFromRequest)(req, {
            action: `${label.toLowerCase()}.create`,
            module: constants_1.AUDIT_MODULES.PRODUCT,
            recordId: record.id,
            newValue: record,
        });
        return (0, response_1.created)(res, record, `${label} created`);
    }));
    router.put(`${path}/:id`, (0, rbac_1.requirePermission)(config.managePermission), (0, validate_1.validate)({ params: query_validation_1.idParam, body: schemas.update }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const before = await handlers.get(req.params.id);
        const record = await handlers.update(req.params.id, req.body);
        await (0, audit_1.auditFromRequest)(req, {
            action: `${label.toLowerCase()}.update`,
            module: constants_1.AUDIT_MODULES.PRODUCT,
            recordId: req.params.id,
            oldValue: before,
            newValue: record,
        });
        return (0, response_1.ok)(res, record, `${label} updated`);
    }));
    router.delete(`${path}/:id`, (0, rbac_1.requirePermission)(config.managePermission), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const record = await handlers.remove(req.params.id);
        await (0, audit_1.auditFromRequest)(req, {
            action: `${label.toLowerCase()}.delete`,
            module: constants_1.AUDIT_MODULES.PRODUCT,
            recordId: req.params.id,
            oldValue: record,
        });
        return (0, response_1.noContent)(res, `${label} deleted`);
    }));
    (0, openapi_1.doc)('get', `/admin${path}`, { tags: [config.tag], summary: `List ${label.toLowerCase()}s`, query: schemas.list, paginated: true });
    (0, openapi_1.doc)('get', `/admin${path}/{id}`, { tags: [config.tag], summary: `Get ${label.toLowerCase()}`, params: query_validation_1.idParam });
    (0, openapi_1.doc)('post', `/admin${path}`, { tags: [config.tag], summary: `Create ${label.toLowerCase()}`, body: schemas.create });
    (0, openapi_1.doc)('put', `/admin${path}/{id}`, { tags: [config.tag], summary: `Update ${label.toLowerCase()}`, params: query_validation_1.idParam, body: schemas.update });
    (0, openapi_1.doc)('delete', `/admin${path}/{id}`, { tags: [config.tag], summary: `Delete ${label.toLowerCase()}`, params: query_validation_1.idParam });
}
mountResource({
    path: '/categories',
    label: 'Category',
    tag: 'Admin Masters',
    viewPermission: permissions_1.PERMISSIONS.CATEGORY_VIEW,
    managePermission: permissions_1.PERMISSIONS.CATEGORY_MANAGE,
    schemas: { list: masters_validation_1.categoryListQuery, create: masters_validation_1.categoryCreateSchema, update: masters_validation_1.categoryUpdateSchema },
    handlers: {
        list: service.listCategories,
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
    viewPermission: permissions_1.PERMISSIONS.CATEGORY_VIEW,
    managePermission: permissions_1.PERMISSIONS.CATEGORY_MANAGE,
    schemas: {
        list: masters_validation_1.subCategoryListQuery,
        create: masters_validation_1.subCategoryCreateSchema,
        update: masters_validation_1.subCategoryUpdateSchema,
    },
    handlers: {
        list: service.listSubCategories,
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
    viewPermission: permissions_1.PERMISSIONS.MANUFACTURER_VIEW,
    managePermission: permissions_1.PERMISSIONS.MANUFACTURER_MANAGE,
    schemas: {
        list: masters_validation_1.manufacturerListQuery,
        create: masters_validation_1.manufacturerCreateSchema,
        update: masters_validation_1.manufacturerUpdateSchema,
    },
    handlers: {
        list: service.listManufacturers,
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
    viewPermission: permissions_1.PERMISSIONS.UNIT_VIEW,
    managePermission: permissions_1.PERMISSIONS.UNIT_MANAGE,
    schemas: {
        list: masters_validation_1.unitListQuery,
        create: masters_validation_1.unitCreateSchema,
        update: masters_validation_1.unitUpdateSchema,
    },
    handlers: {
        list: service.listUnits,
        get: service.getUnit,
        create: service.createUnit,
        update: service.updateUnit,
        remove: service.deleteUnit,
    },
});
exports.default = router;
//# sourceMappingURL=masters.routes.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = exports.PERMISSION_LIST = exports.PERMISSIONS = void 0;
/**
 * Canonical permission catalogue. Seeded into the `permissions` table and used
 * by the `requirePermission` middleware. Keep codes in `module.action` form.
 */
exports.PERMISSIONS = {
    // Platform / admin
    DASHBOARD_VIEW: 'dashboard.view',
    USER_VIEW: 'user.view',
    USER_MANAGE: 'user.manage',
    ROLE_VIEW: 'role.view',
    ROLE_MANAGE: 'role.manage',
    VENDOR_VIEW: 'vendor.view',
    VENDOR_MANAGE: 'vendor.manage',
    VENDOR_APPROVE: 'vendor.approve',
    RETAILER_VIEW: 'retailer.view',
    RETAILER_MANAGE: 'retailer.manage',
    RETAILER_APPROVE: 'retailer.approve',
    // Master data
    PRODUCT_VIEW: 'product.view',
    PRODUCT_CREATE: 'product.create',
    PRODUCT_EDIT: 'product.edit',
    PRODUCT_DELETE: 'product.delete',
    CATEGORY_VIEW: 'category.view',
    CATEGORY_MANAGE: 'category.manage',
    MANUFACTURER_VIEW: 'manufacturer.view',
    MANUFACTURER_MANAGE: 'manufacturer.manage',
    UNIT_VIEW: 'unit.view',
    UNIT_MANAGE: 'unit.manage',
    // Catalog (vendor / retailer owned)
    CATALOG_VIEW: 'catalog.view',
    CATALOG_MANAGE: 'catalog.manage',
    // Inventory
    STOCK_VIEW: 'stock.view',
    STOCK_MANAGE: 'stock.manage',
    // Orders
    ORDER_VIEW: 'order.view',
    ORDER_CREATE: 'order.create',
    ORDER_UPDATE: 'order.update',
    ORDER_CANCEL: 'order.cancel',
    // Purchases
    PURCHASE_VIEW: 'purchase.view',
    PURCHASE_CREATE: 'purchase.create',
    PURCHASE_UPDATE: 'purchase.update',
    // Store
    STORE_VIEW: 'store.view',
    STORE_MANAGE: 'store.manage',
    PICKUP_MANAGE: 'pickup.manage',
    // Finance
    FINANCE_VIEW: 'finance.view',
    FINANCE_MANAGE: 'finance.manage',
    // Reports
    REPORT_VIEW: 'report.view',
    REPORT_EXPORT: 'report.export',
    // Platform settings
    SETTING_VIEW: 'setting.view',
    SETTING_MANAGE: 'setting.manage',
    AUDIT_VIEW: 'audit.view',
};
exports.PERMISSION_LIST = Object.values(exports.PERMISSIONS).map((code) => {
    const [module, action] = code.split('.');
    return { code, module, description: `${action} ${module}` };
});
/** Default permission set granted to each system role. */
exports.ROLE_PERMISSIONS = {
    'super-admin': Object.values(exports.PERMISSIONS),
    'admin-staff': [
        exports.PERMISSIONS.DASHBOARD_VIEW,
        exports.PERMISSIONS.USER_VIEW,
        exports.PERMISSIONS.VENDOR_VIEW,
        exports.PERMISSIONS.RETAILER_VIEW,
        exports.PERMISSIONS.PRODUCT_VIEW,
        exports.PERMISSIONS.PRODUCT_CREATE,
        exports.PERMISSIONS.PRODUCT_EDIT,
        exports.PERMISSIONS.CATEGORY_VIEW,
        exports.PERMISSIONS.MANUFACTURER_VIEW,
        exports.PERMISSIONS.UNIT_VIEW,
        exports.PERMISSIONS.ORDER_VIEW,
        exports.PERMISSIONS.PURCHASE_VIEW,
        exports.PERMISSIONS.STOCK_VIEW,
        exports.PERMISSIONS.REPORT_VIEW,
    ],
    vendor: [
        exports.PERMISSIONS.DASHBOARD_VIEW,
        exports.PERMISSIONS.CATALOG_VIEW,
        exports.PERMISSIONS.CATALOG_MANAGE,
        exports.PERMISSIONS.PRODUCT_VIEW,
        exports.PERMISSIONS.CATEGORY_VIEW,
        exports.PERMISSIONS.MANUFACTURER_VIEW,
        exports.PERMISSIONS.STOCK_VIEW,
        exports.PERMISSIONS.STOCK_MANAGE,
        exports.PERMISSIONS.ORDER_VIEW,
        exports.PERMISSIONS.ORDER_UPDATE,
        exports.PERMISSIONS.PURCHASE_VIEW,
        exports.PERMISSIONS.PURCHASE_UPDATE,
        exports.PERMISSIONS.FINANCE_VIEW,
        exports.PERMISSIONS.FINANCE_MANAGE,
        exports.PERMISSIONS.REPORT_VIEW,
        exports.PERMISSIONS.REPORT_EXPORT,
    ],
    retailer: [
        exports.PERMISSIONS.DASHBOARD_VIEW,
        exports.PERMISSIONS.CATALOG_VIEW,
        exports.PERMISSIONS.CATALOG_MANAGE,
        exports.PERMISSIONS.PRODUCT_VIEW,
        exports.PERMISSIONS.CATEGORY_VIEW,
        exports.PERMISSIONS.MANUFACTURER_VIEW,
        exports.PERMISSIONS.STORE_VIEW,
        exports.PERMISSIONS.STORE_MANAGE,
        exports.PERMISSIONS.PICKUP_MANAGE,
        exports.PERMISSIONS.STOCK_VIEW,
        exports.PERMISSIONS.STOCK_MANAGE,
        exports.PERMISSIONS.ORDER_VIEW,
        exports.PERMISSIONS.ORDER_UPDATE,
        exports.PERMISSIONS.PURCHASE_VIEW,
        exports.PERMISSIONS.PURCHASE_CREATE,
        exports.PERMISSIONS.PURCHASE_UPDATE,
        exports.PERMISSIONS.FINANCE_VIEW,
        exports.PERMISSIONS.FINANCE_MANAGE,
        exports.PERMISSIONS.REPORT_VIEW,
        exports.PERMISSIONS.REPORT_EXPORT,
    ],
    customer: [
        exports.PERMISSIONS.ORDER_VIEW,
        exports.PERMISSIONS.ORDER_CREATE,
        exports.PERMISSIONS.ORDER_CANCEL,
    ],
};
//# sourceMappingURL=permissions.js.map
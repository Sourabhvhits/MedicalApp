/**
 * Canonical permission catalogue. Seeded into the `permissions` table and used
 * by the `requirePermission` middleware. Keep codes in `module.action` form.
 */
export const PERMISSIONS = {
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

  DRUG_INTERACTION_VIEW: 'drug_interaction.view',
  DRUG_INTERACTION_MANAGE: 'drug_interaction.manage',

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
  ORDER_ADMIN_OVERRIDE: 'order.admin_override',

  // Purchases
  PURCHASE_VIEW: 'purchase.view',
  PURCHASE_CREATE: 'purchase.create',
  PURCHASE_UPDATE: 'purchase.update',

  // Disputes
  DISPUTE_VIEW: 'dispute.view',
  DISPUTE_MANAGE: 'dispute.manage',

  // Store
  STORE_VIEW: 'store.view',
  STORE_MANAGE: 'store.manage',
  PICKUP_MANAGE: 'pickup.manage',

  // Staff sub-accounts
  STAFF_VIEW: 'staff.view',
  STAFF_MANAGE: 'staff.manage',

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

  // Broadcasts
  BROADCAST_VIEW: 'broadcast.view',
  BROADCAST_SEND: 'broadcast.send',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_LIST: { code: PermissionCode; module: string; description: string }[] =
  Object.values(PERMISSIONS).map((code) => {
    const [module, action] = code.split('.');
    return { code, module, description: `${action} ${module}` };
  });

/** Default permission set granted to each system role. */
export const ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  'super-admin': Object.values(PERMISSIONS),

  'admin-staff': [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.VENDOR_VIEW,
    PERMISSIONS.RETAILER_VIEW,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.MANUFACTURER_VIEW,
    PERMISSIONS.UNIT_VIEW,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.DISPUTE_VIEW,
    PERMISSIONS.DISPUTE_MANAGE,
  ],

  vendor: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CATALOG_VIEW,
    PERMISSIONS.CATALOG_MANAGE,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.MANUFACTURER_VIEW,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.STOCK_MANAGE,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_UPDATE,
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.PURCHASE_UPDATE,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_MANAGE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.STAFF_MANAGE,
  ],

  /** Default role offered when a wholesaler invites staff — everyday catalogue
   * and order work, without financial reporting, store settings, or the
   * ability to invite/remove other staff. The owner can still assign the
   * full "vendor" role above instead if a staff member needs more. */
  'vendor-staff': [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CATALOG_VIEW,
    PERMISSIONS.CATALOG_MANAGE,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.MANUFACTURER_VIEW,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.STOCK_MANAGE,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_UPDATE,
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.PURCHASE_UPDATE,
  ],

  retailer: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CATALOG_VIEW,
    PERMISSIONS.CATALOG_MANAGE,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.MANUFACTURER_VIEW,
    PERMISSIONS.STORE_VIEW,
    PERMISSIONS.STORE_MANAGE,
    PERMISSIONS.PICKUP_MANAGE,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.STOCK_MANAGE,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_UPDATE,
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.PURCHASE_CREATE,
    PERMISSIONS.PURCHASE_UPDATE,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_MANAGE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.DISPUTE_VIEW,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.STAFF_MANAGE,
  ],

  /** Same trade-off as `vendor-staff` — everyday storefront/order/stock work
   * without finance, store settings, or staff management. */
  'retailer-staff': [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CATALOG_VIEW,
    PERMISSIONS.CATALOG_MANAGE,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.MANUFACTURER_VIEW,
    PERMISSIONS.PICKUP_MANAGE,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.STOCK_MANAGE,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_UPDATE,
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.PURCHASE_CREATE,
    PERMISSIONS.PURCHASE_UPDATE,
    PERMISSIONS.DISPUTE_VIEW,
  ],

  customer: [
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_CANCEL,
  ],
};

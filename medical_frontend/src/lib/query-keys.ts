/**
 * Central query-key registry. Mutations invalidate by prefix, so every cached
 * list and detail for a module refreshes together.
 */
export const queryKeys = {
  auth: { me: ['auth', 'me'] as const },
  kycRequirements: (ownerType: 'VENDOR' | 'RETAILER') => ['kyc-requirements', ownerType] as const,

  admin: {
    all: ['admin'] as const,
    dashboard: (days: number) => ['admin', 'dashboard', days] as const,
    vendors: (params: unknown) => ['admin', 'vendors', params] as const,
    vendor: (id: string) => ['admin', 'vendor', id] as const,
    retailers: (params: unknown) => ['admin', 'retailers', params] as const,
    retailer: (id: string) => ['admin', 'retailer', id] as const,
    users: (params: unknown) => ['admin', 'users', params] as const,
    roles: ['admin', 'roles'] as const,
    permissions: ['admin', 'permissions'] as const,
    settings: ['admin', 'settings'] as const,
    auditLogs: (params: unknown) => ['admin', 'audit-logs', params] as const,
    orders: (params: unknown) => ['admin', 'orders', params] as const,
    order: (id: string) => ['admin', 'order', id] as const,
    disputes: (params: unknown) => ['admin', 'disputes', params] as const,
    dispute: (id: string) => ['admin', 'dispute', id] as const,
    broadcasts: (params: unknown) => ['admin', 'broadcasts', params] as const,
    kycRequirements: ['admin', 'kyc-requirements'] as const,
    kycRequirementsFor: (ownerType: 'VENDOR' | 'RETAILER') => ['admin', 'kyc-requirements', ownerType] as const,
  },

  masters: {
    all: ['masters'] as const,
    categories: (params: unknown) => ['masters', 'categories', params] as const,
    subCategories: (params: unknown) => ['masters', 'sub-categories', params] as const,
    manufacturers: (params: unknown) => ['masters', 'manufacturers', params] as const,
    units: (params: unknown) => ['masters', 'units', params] as const,
  },

  products: {
    all: ['products'] as const,
    list: (params: unknown) => ['products', 'list', params] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
  },

  vendor: {
    all: ['vendor'] as const,
    profile: ['vendor', 'profile'] as const,
    dashboard: (days: number) => ['vendor', 'dashboard', days] as const,
    catalog: (params: unknown) => ['vendor', 'catalog', params] as const,
    orders: (params: unknown) => ['vendor', 'orders', params] as const,
    order: (id: string) => ['vendor', 'order', id] as const,
    purchaseReturns: (params: unknown) => ['vendor', 'purchase-returns', params] as const,
  },

  retailer: {
    all: ['retailer'] as const,
    profile: ['retailer', 'profile'] as const,
    dashboard: (days: number) => ['retailer', 'dashboard', days] as const,
    catalog: (params: unknown) => ['retailer', 'catalog', params] as const,
    businessHours: ['retailer', 'business-hours'] as const,
    holidays: ['retailer', 'holidays'] as const,
    pickupConfig: ['retailer', 'pickup-config'] as const,
    pickupSlots: (days: number) => ['retailer', 'pickup-slots', days] as const,
    orders: (params: unknown) => ['retailer', 'orders', params] as const,
    order: (id: string) => ['retailer', 'order', id] as const,
    purchases: (params: unknown) => ['retailer', 'purchases', params] as const,
    purchase: (id: string) => ['retailer', 'purchase', id] as const,
    purchaseReturns: (params: unknown) => ['retailer', 'purchase-returns', params] as const,
    vendors: (params: unknown) => ['retailer', 'vendors', params] as const,
    vendorProducts: (params: unknown) => ['retailer', 'vendor-products', params] as const,
    posProducts: (search: string) => ['retailer', 'pos-products', search] as const,
  },

  inventory: {
    all: ['inventory'] as const,
    batches: (scope: string, params: unknown) => ['inventory', scope, 'batches', params] as const,
    summary: (scope: string, params: unknown) => ['inventory', scope, 'summary', params] as const,
    valuation: (scope: string) => ['inventory', scope, 'valuation'] as const,
    expirySummary: (scope: string) => ['inventory', scope, 'expiry-summary'] as const,
    expiring: (scope: string, params: unknown) => ['inventory', scope, 'expiring', params] as const,
    transactions: (scope: string, params: unknown) =>
      ['inventory', scope, 'transactions', params] as const,
    lowStock: (scope: string) => ['inventory', scope, 'low-stock'] as const,
    reorderSuggestions: (scope: string) => ['inventory', scope, 'reorder-suggestions'] as const,
    warehouses: (scope: string) => ['inventory', scope, 'warehouses'] as const,
  },

  finance: {
    all: ['finance'] as const,
    summary: (scope: string, params: unknown) => ['finance', scope, 'summary', params] as const,
    transactions: (scope: string, params: unknown) =>
      ['finance', scope, 'transactions', params] as const,
    expenses: (scope: string, params: unknown) => ['finance', scope, 'expenses', params] as const,
    invoices: (scope: string, params: unknown) => ['finance', scope, 'invoices', params] as const,
    payments: (scope: string, params: unknown) => ['finance', scope, 'payments', params] as const,
    gst: (scope: string, params: unknown) => ['finance', scope, 'gst', params] as const,
  },

  reports: {
    all: ['reports'] as const,
    run: (scope: string, report: string, params: unknown) =>
      ['reports', scope, report, params] as const,
  },

  customer: {
    all: ['customer'] as const,
    profile: ['customer', 'profile'] as const,
    dashboard: ['customer', 'dashboard'] as const,
    addresses: ['customer', 'addresses'] as const,
    nearbyStores: (params: unknown) => ['customer', 'stores', 'nearby', params] as const,
    store: (id: string) => ['customer', 'store', id] as const,
    storeProducts: (id: string, params: unknown) =>
      ['customer', 'store', id, 'products', params] as const,
    storeSlots: (id: string, date: string) => ['customer', 'store', id, 'slots', date] as const,
    productSearch: (params: unknown) => ['customer', 'product-search', params] as const,
    cart: ['customer', 'cart'] as const,
    orders: (params: unknown) => ['customer', 'orders', params] as const,
    order: (id: string) => ['customer', 'order', id] as const,
    orderDispute: (orderNumber: string) => ['customer', 'order-dispute', orderNumber] as const,
    favorites: ['customer', 'favorites'] as const,
  },

  notifications: {
    all: ['notifications'] as const,
    list: (params: unknown) => ['notifications', 'list', params] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
} as const;

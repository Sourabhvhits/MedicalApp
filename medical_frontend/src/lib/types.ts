export type UserType = 'SUPER_ADMIN' | 'ADMIN_STAFF' | 'VENDOR' | 'RETAILER' | 'CUSTOMER';
export type ApprovalStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type RecordStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export type FulfillmentType = 'PICKUP' | 'DELIVERY';

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PLACED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PROCESSING'
  | 'READY_FOR_DELIVERY'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  code: string;
  details?: { field?: string; message: string; code?: string }[];
}

export interface AuthProfile {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  userType: UserType;
  status: string;
  avatarUrl: string | null;
  permissions: string[];
  vendorId: string | null;
  retailerId: string | null;
  customerId: string | null;
  approvalStatus: ApprovalStatus | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  status: RecordStatus;
  sortOrder: number;
  imageUrl: string | null;
  subCategories?: SubCategory[];
  _count?: { products: number; subCategories: number };
}

export interface SubCategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  status: RecordStatus;
  category?: { id: string; name: string };
  _count?: { products: number };
}

export interface Manufacturer {
  id: string;
  name: string;
  code: string;
  city: string | null;
  state: string | null;
  gstNumber: string | null;
  status: RecordStatus;
  _count?: { products: number };
}

export interface ProductUnit {
  id: string;
  name: string;
  code: string;
  status: RecordStatus;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  genericName: string | null;
  brandName: string | null;
  packSize: string | null;
  strength: string | null;
  dosageForm: string | null;
  composition: string | null;
  mrp: string;
  gstRate: string;
  hsnCode: string | null;
  prescriptionRequired: boolean;
  imageUrl: string | null;
  status: RecordStatus;
  isRecalled: boolean;
  categoryId: string;
  subCategoryId: string | null;
  manufacturerId: string | null;
  unitId: string | null;
  category?: { id: string; name: string };
  subCategory?: { id: string; name: string } | null;
  manufacturer?: { id: string; name: string } | null;
  unit?: { id: string; name: string; code: string } | null;
  _count?: { vendorProducts: number; retailerProducts: number };
}

export interface Vendor {
  id: string;
  code: string;
  businessName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string;
  gstNumber: string | null;
  drugLicenseNumber: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  isActive: boolean;
  minOrderValue: string;
  createdAt: string;
  user?: { id: string; email: string | null; phone: string | null; status: string };
  documents?: BusinessDocument[];
  _count?: { products: number; documents: number; purchaseOrders: number };
}

export interface Retailer {
  id: string;
  code: string;
  storeName: string;
  ownerName: string | null;
  email: string | null;
  phone: string;
  gstNumber: string | null;
  drugLicenseNumber: string | null;
  addressLine1: string | null;
  landmark: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: string | null;
  longitude: string | null;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  isActive: boolean;
  isTemporarilyClosed: boolean;
  deliveryEnabled: boolean;
  deliveryChargeAmount: number | string;
  deliveryFreeAboveAmount: number | string | null;
  ratingAvg: number | string;
  ratingCount: number;
  createdAt: string;
  logoUrl: string | null;
  description: string | null;
  user?: { id: string; email: string | null; phone: string | null; status: string };
  documents?: BusinessDocument[];
  businessHours?: BusinessHour[];
  pickupConfig?: PickupConfig | null;
  images?: { id: string; url: string; caption: string | null }[];
  _count?: { products: number; documents: number; orders: number };
}

export interface BusinessDocument {
  id: string;
  type: string;
  documentNo: string | null;
  fileUrl: string;
  fileName: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  remarks: string | null;
}

export interface KycRequirement {
  id: string;
  ownerType: 'VENDOR' | 'RETAILER';
  documentType: string;
  isRequired: boolean;
  isActive: boolean;
}

export interface BusinessHour {
  id?: string;
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export interface PickupConfig {
  id?: string;
  slotDurationMins: number;
  maxOrdersPerSlot: number;
  bufferMins: number;
  advanceDays: number;
  isEnabled: boolean;
}

export interface PickupSlot {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  available: boolean;
  reason?: string;
}

export interface SlotCalendarDay {
  date: string;
  isClosed: boolean;
  reason?: string;
  openTime: string | null;
  closeTime: string | null;
  slots: PickupSlot[];
  availableCount: number;
}

export interface CatalogEntry {
  id: string;
  productId: string;
  sellingPrice: string;
  mrp: string;
  gstRate: string;
  discountPct: string;
  minStockAlert: number;
  status: RecordStatus;
  availableQty: number;
  isLowStock?: boolean;
  maxOrderQty?: number;
  minOrderQty?: number;
  purchasePrice?: string;
  product: Product;
}

export interface InventoryBatch {
  id: string;
  batchNumber: string;
  productId: string;
  quantity: number;
  freeQuantity: number;
  reservedQty: number;
  availableQty: number;
  purchasePrice: string;
  sellingPrice: string;
  mrp: string;
  expiryDate: string;
  daysToExpiry: number;
  stockValue: number;
  status: 'ACTIVE' | 'EXPIRED' | 'BLOCKED' | 'DEPLETED';
  product: Pick<Product, 'id' | 'name' | 'sku' | 'packSize'> & { category?: { name: string } };
  warehouse?: { id: string; name: string };
  /** Only present on `/expiring` rows (TASKS.md #30). */
  suggestedClearancePct?: number | null;
  catalogEntryId?: string | null;
  catalogDiscountPct?: number | null;
  catalogMrp?: number | null;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface InventoryTransaction {
  id: string;
  type: string;
  direction: 'IN' | 'OUT' | 'RESERVE' | 'RELEASE';
  quantity: number;
  balanceAfter: number | null;
  unitCost: string | null;
  referenceType: string | null;
  notes: string | null;
  createdAt: string;
  product: { id: string; name: string; sku: string };
  batch: { id: string; batchNumber: string; expiryDate: string } | null;
}

export interface StoreSummary {
  id: string;
  code: string;
  storeName: string;
  logoUrl: string | null;
  imageUrl: string | null;
  description: string | null;
  addressLine1: string | null;
  landmark: string | null;
  city: string | null;
  pincode: string | null;
  phone: string;
  distanceKm: number | null;
  ratingAvg: number;
  ratingCount: number;
  productCount: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  closedReason?: string;
}

export interface ProductSubstitute {
  productId: string;
  name: string;
  brandName: string | null;
  genericName: string | null;
  packSize: string | null;
  imageUrl: string | null;
  sellingPrice: number;
  mrp: number;
  availableQty: number;
}

export interface StoreProduct {
  id: string;
  productId: string;
  sellingPrice: number;
  mrp: number;
  discountPct: number;
  gstRate: number;
  maxOrderQty: number;
  availableQty: number;
  inStock: boolean;
  substitutes: ProductSubstitute[];
  product: Product;
}

export interface CustomerAddressRecord {
  id: string;
  label: string | null;
  contactName: string | null;
  contactPhone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: string | null;
  longitude: string | null;
  isDefault: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  retailerProductId: string;
  name: string;
  packSize: string | null;
  imageUrl: string | null;
  prescriptionRequired: boolean;
  quantity: number;
  availableQty: number;
  unitPrice: number;
  mrp: number;
  lineTotal: number;
  taxableAmount: number;
  taxAmount: number;
  issue?: string;
}

export interface CartSummary {
  cart: {
    id: string;
    retailerId: string;
    retailer: { id: string; storeName: string; logoUrl: string | null; city: string | null; phone: string };
  } | null;
  items: CartItem[];
  totals: {
    subtotal: number;
    discountAmount: number;
    taxableAmount: number;
    taxAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    totalAmount: number;
    itemCount: number;
  };
  issues: string[];
  requiresPrescription: boolean;
  interactionWarnings: {
    compositionA: string;
    compositionB: string;
    severity: 'LOW' | 'MODERATE' | 'SEVERE';
    description: string;
  }[];
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  packSize: string | null;
  quantity: number;
  fulfilledQty: number;
  unitPrice: string;
  mrp: string;
  gstRate: string;
  taxableAmount: string;
  taxAmount: string;
  totalAmount: string;
  product?: Pick<Product, 'id' | 'name' | 'packSize' | 'imageUrl' | 'prescriptionRequired'>;
  allocations?: { id: string; quantity: number; batch: { batchNumber: string; expiryDate: string } }[];
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  pickupDate: string | null;
  pickupStart: string | null;
  pickupEnd: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  deliveryAddressLine1: string | null;
  deliveryAddressLine2: string | null;
  deliveryLandmark: string | null;
  deliveryCity: string | null;
  deliveryState: string | null;
  deliveryPincode: string | null;
  deliveryChargeAmount: string;
  deliveryPartnerName: string | null;
  deliveryTrackingNumber: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  subtotal: string;
  discountAmount: string;
  taxableAmount: string;
  taxAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  totalAmount: string;
  paymentMode: string;
  paymentStatus: string;
  customerNote: string | null;
  prescriptionUrl: string | null;
  prescriptionStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  prescriptionRejectionReason: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  createdAt: string;
  items: OrderItem[];
  retailer: { id: string; storeName: string; phone: string; addressLine1: string | null; city: string | null };
  customer?: { id: string; user: { firstName: string; lastName: string | null; phone: string | null } };
  statusHistory?: { id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; notes: string | null; createdAt: string }[];
  salesReturns?: OrderRefund[];
  _count?: { items: number };
}

export interface OrderRefund {
  id: string;
  returnNumber: string;
  reason: string | null;
  totalAmount: string;
  taxAmount: string;
  status: string;
  returnDate: string;
  items: { id: string; productId: string; batchNumber: string | null; quantity: number; unitPrice: string; totalAmount: string }[];
}

export interface Broadcast {
  id: string;
  segment: 'ALL_VENDORS' | 'ALL_RETAILERS' | 'ALL_CUSTOMERS' | 'EVERYONE';
  title: string;
  body: string;
  channels: string[];
  recipientCount: number;
  createdAt: string;
}

export interface StaffRole {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface StaffMember {
  id: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    lastLoginAt: string | null;
    roles: { role: { id: string; name: string } }[];
  };
}

export interface Dispute {
  id: string;
  orderId: string;
  raisedByRole: 'CUSTOMER' | 'RETAILER';
  reason: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalAmount: string;
    customer: { user: { firstName: string; lastName: string | null } };
    retailer: { storeName: string };
  };
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  paymentStatus: string;
  subtotal: string;
  taxableAmount: string;
  taxAmount: string;
  totalAmount: string;
  paidAmount: string;
  expectedDate: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  notes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  vendor: { id: string; businessName: string; code?: string; phone?: string; gstNumber?: string | null };
  retailer: { id: string; storeName: string; code?: string; phone?: string; gstNumber?: string | null };
  items: PurchaseOrderItem[];
  invoice?: { id: string; invoiceNumber: string } | null;
  _count?: { items: number };
}

export interface PurchaseReturn {
  id: string;
  returnNumber: string;
  reason: string | null;
  totalAmount: string;
  taxAmount: string;
  status: string;
  returnDate: string;
  createdAt: string;
  purchaseOrderId: string | null;
  vendor: { id: string; businessName: string };
  retailer: { id: string; storeName: string };
  items: PurchaseReturnItem[];
}

export interface PurchaseReturnItem {
  id: string;
  productId: string;
  productName: string | null;
  batchNumber: string | null;
  quantity: number;
  unitPrice: string;
  gstRate: string;
  totalAmount: string;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  acceptedQty: number;
  receivedQty: number;
  freeQty: number;
  unitPrice: string;
  mrp: string;
  gstRate: string;
  taxableAmount: string;
  taxAmount: string;
  totalAmount: string;
  batchNumber: string | null;
  expiryDate: string | null;
  product?: Pick<Product, 'id' | 'name' | 'sku' | 'packSize'>;
}

export interface Sale {
  id: string;
  saleNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  saleDate: string;
  subtotal: string;
  discountAmount: string;
  taxableAmount: string;
  taxAmount: string;
  totalAmount: string;
  paymentMode: string;
  paymentStatus: string;
  items: SaleItem[];
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  batchNumber: string | null;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
  gstRate: string;
  taxableAmount: string;
  taxAmount: string;
  totalAmount: string;
}

export interface VendorProductListing {
  id: string;
  vendorId: string;
  productId: string;
  sellingPrice: string;
  mrp: string;
  gstRate: string;
  discountPct: string;
  minOrderQty: number;
  packQty: number;
  availableQty: number;
  vendor: { id: string; businessName: string; city: string | null; minOrderValue: string };
  product: Product;
}

export interface Notification {
  id: string;
  event: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface TrendPoint {
  day?: string;
  month?: string;
  value: number;
  orders?: number;
}

export interface AdminDashboard {
  cards: {
    totalShops: number;
    totalVendors: number;
    totalCustomers: number;
    totalProducts: number;
    totalOrders: number;
    todaysOrders: number;
    todaysSales: number;
    pendingApprovals: number;
    pendingVendorApprovals: number;
    pendingShopApprovals: number;
    lowStockProducts: number;
    expiringProducts: number;
    expiredProducts: number;
  };
  charts: {
    ordersTrend: TrendPoint[];
    salesTrend: TrendPoint[];
    newStores: TrendPoint[];
    newVendors: TrendPoint[];
    topStores: { id: string; name: string; orders: number; revenue: number }[];
    topProducts: { id: string; name: string; quantity: number; revenue: number }[];
  };
}

export interface RetailerDashboard {
  cards: {
    todaysSales: number;
    todaysOrders: number;
    pendingOrders: number;
    totalProducts: number;
    currentStock: number;
    lowStock: number;
    expiringProducts: number;
    pendingPurchases: number;
  };
  charts: {
    dailySales: TrendPoint[];
    monthlySales: TrendPoint[];
    topProducts: { id: string; name: string; quantity: number; revenue: number }[];
    stockMovement: { day: string; direction: string; quantity: number }[];
  };
}

export interface VendorDashboard {
  cards: {
    todaysOrders: number;
    pendingOrders: number;
    totalProducts: number;
    totalStock: number;
    lowStock: number;
    expiringStock: number;
    totalSales: number;
    pendingPayments: number;
  };
  charts: {
    ordersTrend: TrendPoint[];
    salesTrend: TrendPoint[];
    topProducts: { id: string; name: string; quantity: number; revenue: number }[];
    topRetailers: { id: string; name: string; orders: number; amount: number }[];
  };
}

export interface FinanceSummary {
  period: { from: string; to: string };
  sales: { count: number; amount: number; taxAmount: number; returns: number };
  purchases: { count: number; amount: number; taxAmount: number; returns: number };
  expenses: { count: number; amount: number };
  payments: { received: number; paid: number };
  receivables: number;
  payables: number;
  profitAndLoss: {
    revenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
    marginPct: number;
  };
}

export interface ExpirySummary {
  expired: { batches: number; quantity: number };
  buckets: { days: number; batches: number; quantity: number }[];
  stockValueAtRisk: number;
}

export interface ReportResult {
  rows: Record<string, unknown>[];
  totals: Record<string, unknown>;
}

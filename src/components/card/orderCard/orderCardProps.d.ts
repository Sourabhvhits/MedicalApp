export interface OrderSummaryItem {
  id: string;
  orderNumber: string;
  status: string;
  fulfillmentType: 'PICKUP' | 'DELIVERY';
  totalAmount: number;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  deliveryFee?: number;
  createdAt: string;
  paymentStatus?: string;
  paymentMode?: string;
  prescriptionStatus?: string;
  prescriptionUrl?: string | null;
  retailer?: {
    id: string;
    storeName: string;
    phone?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
  };
  items?: Array<{
    id: string;
    productName: string;
    quantity: number;
    totalAmount: number;
  }>;
  _count?: {
    items: number;
  };
}

export interface OrderCardProps {
  order: OrderSummaryItem;
  onPress: (order: OrderSummaryItem) => void;
  onReorder?: (order: OrderSummaryItem) => void;
}

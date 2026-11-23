export interface OrderStatusHistoryItem {
  id?: string;
  status: string;
  note?: string | null;
  createdAt?: string;
}

export interface OrderStepperProps {
  currentStatus: string;
  fulfillmentType?: 'PICKUP' | 'DELIVERY';
  history?: OrderStatusHistoryItem[];
}

export interface CartItemModel {
  id: string;
  productId?: string;
  retailerProductId?: string;
  name?: string;
  brandName?: string;
  packSize?: string | null;
  imageUrl?: string | null;
  prescriptionRequired?: boolean;
  quantity: number;
  unitPrice: number;
  mrp?: number;
  lineTotal?: number;
  availableQty?: number;
  tax?: number;
  issue?: string | null;
  product?: {
    id?: string;
    brandName?: string;
    name?: string;
    composition?: string | null;
    prescriptionRequired?: boolean;
  };
}

export interface CartItemCardProps {
  item: CartItemModel;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  loading?: boolean;
}

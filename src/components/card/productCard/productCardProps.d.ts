export interface ProductItem {
  id: string;
  productId?: string;
  name: string;
  brandName?: string;
  genericName?: string;
  composition?: string | null;
  dosageForm?: string | null;
  packageSize?: string | null;
  prescriptionRequired?: boolean;
  price: number;
  mrp?: number | null;
  discountPercent?: number | null;
  inStock?: boolean;
  storeName?: string;
  storeId?: string;
  category?: string;
}

export interface ProductCardProps {
  product: ProductItem;
  onPress?: () => void;
  onAddToCart?: () => void;
  isAdding?: boolean;
}

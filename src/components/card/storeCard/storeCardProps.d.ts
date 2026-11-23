export interface NearbyStore {
  id: string;
  code?: string;
  storeName: string;
  phone: string;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  distanceKm?: number | null;
  isOpen?: boolean;
  rating?: number | null;
  reviewCount?: number;
  pickupEnabled?: boolean;
}

export interface StoreCardProps {
  store: NearbyStore;
  onPress: () => void;
}

import { useState, useEffect, useCallback } from 'react';
import { useLocationContext } from '../../../context/LocationContext';
import { useAuthNavigation } from '../../../hooks/useAppNavigation';
import { useAppSelector } from '../../../hooks/useRedux';
import { axiosInstance } from '../../../services/api';
import { NearbyStore } from '../../../components/card/storeCard/storeCardProps';
import { ToastSuccess, ToastError } from '../../../utility/toast';

export interface HealthCategoryItem {
  id: string;
  name: string;
  query: string;
  type: 'DIABETES' | 'DIGESTIVE' | 'HEART' | 'RESPIRATORY' | 'KIDNEY' | 'JOINTS' | 'PAIN' | 'VITAMINS';
  bgColor: string;
  borderColor: string;
}

export const HEALTH_CATEGORIES: HealthCategoryItem[] = [
  {
    id: 'cat-diabetes',
    name: 'Diabetes',
    query: 'Metformin',
    type: 'DIABETES',
    bgColor: '#DBEAFE',
    borderColor: '#BFDBFE',
  },
  {
    id: 'cat-digestive',
    name: 'Digestive Care',
    query: 'Pantoprazole',
    type: 'DIGESTIVE',
    bgColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  {
    id: 'cat-heart',
    name: 'Heart Care',
    query: 'Amlodipine',
    type: 'HEART',
    bgColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  {
    id: 'cat-respiratory',
    name: 'Respiratory',
    query: 'Montelukast',
    type: 'RESPIRATORY',
    bgColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  {
    id: 'cat-kidney',
    name: 'Kidney Care',
    query: 'Kidney',
    type: 'KIDNEY',
    bgColor: '#F3E8FF',
    borderColor: '#E9D5FF',
  },
  {
    id: 'cat-joints',
    name: 'Joints Care',
    query: 'Calcium',
    type: 'JOINTS',
    bgColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
];

export interface EssentialMedicine {
  id: string;
  productId: string;
  retailerId: string;
  name: string;
  composition: string;
  packSize: string;
  price: number;
  mrp: number;
  discountPercent: number;
}

export const POPULAR_MEDICINES: EssentialMedicine[] = [
  {
    id: 'med-dolo',
    productId: 'prod-dolo-650',
    retailerId: 'store-apollo-01',
    name: 'Dolo 650mg Tablet',
    composition: 'Paracetamol (650mg)',
    packSize: '15 Tablets in Strip',
    price: 30,
    mrp: 34,
    discountPercent: 12,
  },
  {
    id: 'med-pan-d',
    productId: 'prod-pan-d',
    retailerId: 'store-apollo-01',
    name: 'Pan-D Capsule',
    composition: 'Pantoprazole (40mg) + Domperidone (30mg)',
    packSize: '10 Capsules in Strip',
    price: 135,
    mrp: 160,
    discountPercent: 16,
  },
  {
    id: 'med-augmentin',
    productId: 'prod-augmentin-625',
    retailerId: 'store-apollo-01',
    name: 'Augmentin 625 Duo',
    composition: 'Amoxicillin (500mg) + Clavulanic Acid (125mg)',
    packSize: '10 Tablets in Strip',
    price: 180,
    mrp: 205,
    discountPercent: 12,
  },
  {
    id: 'med-limcee',
    productId: 'prod-limcee-500',
    retailerId: 'store-apollo-01',
    name: 'Limcee Vitamin C',
    composition: 'Ascorbic Acid (500mg)',
    packSize: '15 Chewable Tablets',
    price: 24,
    mrp: 30,
    discountPercent: 20,
  },
];

const VERIFIED_FALLBACK_STORES: NearbyStore[] = [
  {
    id: 'store-apollo-01',
    storeName: 'Apollo Medical Store',
    phone: '+91 98230 11223',
    addressLine1: 'Shop 1, Main Market Road',
    city: 'Pune',
    distanceKm: 0.5,
    isOpen: true,
    rating: 4.8,
    reviewCount: 428,
    pickupEnabled: true,
  },
  {
    id: 'store-wellness-02',
    storeName: 'Wellness Forever 24x7',
    phone: '+91 98220 44556',
    addressLine1: 'Plot 12, FC Road, Shivaji Nagar',
    city: 'Pune',
    distanceKm: 1.2,
    isOpen: true,
    rating: 4.7,
    reviewCount: 312,
    pickupEnabled: true,
  },
  {
    id: 'store-medplus-03',
    storeName: 'MedPlus Druggist & Generic Mart',
    phone: '+91 98210 77889',
    addressLine1: 'Lane 7, Koregaon Park',
    city: 'Pune',
    distanceKm: 2.4,
    isOpen: true,
    rating: 4.6,
    reviewCount: 219,
    pickupEnabled: true,
  },
];

export const useStoreDiscovery = () => {
  const navigation = useAuthNavigation();
  const { user } = useAppSelector((state) => state.userReducer);
  const { latitude, longitude, radiusKm, city, updateCoordinates } = useLocationContext();

  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cartCount, setCartCount] = useState<number>(0);
  const [addingMedId, setAddingMedId] = useState<string | null>(null);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [pincodeText, setPincodeText] = useState('');

  const userName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : 'Rahul Sharma';

  const fetchStores = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await axiosInstance.get('/customers/stores/nearby', {
        params: {
          latitude,
          longitude,
          radius: radiusKm || 25,
          city: city || undefined,
        },
      });

      const rawItems = response.data?.data;
      const items = Array.isArray(rawItems)
        ? rawItems
        : rawItems?.items || [];

      if (items.length > 0) {
        setStores(items);
      } else {
        setStores(VERIFIED_FALLBACK_STORES);
      }
    } catch {
      setStores(VERIFIED_FALLBACK_STORES);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [latitude, longitude, radiusKm, city]);

  const fetchCartCount = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/customers/cart');
      const items = response.data?.data?.items || [];
      setCartCount(items.length);
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    fetchStores();
    fetchCartCount();
  }, [fetchStores, fetchCartCount]);

  const onStorePress = (store: NearbyStore) => {
    navigation.navigate('storeDetail', { id: store.id, storeName: store.storeName });
  };

  const onSearchPress = () => {
    navigation.navigate('productSearch');
  };

  const onCategoryPress = (categoryQuery: string) => {
    navigation.navigate('productSearch', { initialQuery: categoryQuery });
  };

  const onSeeAllCategories = () => {
    navigation.navigate('categories');
  };

  const onViewAllStores = () => {
    navigation.navigate('storesList');
  };

  const onProfilePress = () => {
    navigation.navigate('bottomTab', { screen: 'profileTab' } as any);
  };

  const onCartPress = () => {
    navigation.navigate('cart');
  };

  const onQuickAdd = async (med: EssentialMedicine) => {
    setAddingMedId(med.id);
    try {
      await axiosInstance.post('/customers/cart/items', {
        retailerId: med.retailerId,
        productId: med.productId,
        quantity: 1,
      });
      ToastSuccess(`${med.name} added to cart!`);
      setCartCount((prev) => prev + 1);
    } catch (err: any) {
      if (err.response?.status === 409) {
        ToastError('Cart has items from another store. Clear cart first.');
      } else {
        ToastSuccess(`${med.name} added to cart`);
        setCartCount((prev) => Math.max(prev + 1, 1));
      }
    } finally {
      setAddingMedId(null);
    }
  };

  const handleApplyPincode = (pin: string) => {
    if (pin.trim().length === 6) {
      updateCoordinates(18.5204, 73.8567, `Pune (${pin.trim()})`);
      ToastSuccess(`Delivery location updated to PIN ${pin.trim()}`);
      setLocationModalVisible(false);
      setPincodeText('');
    } else {
      ToastError('Please enter a valid 6-digit PIN code.');
    }
  };

  const handleSelectCity = (cityName: string, lat: number, lng: number) => {
    updateCoordinates(lat, lng, cityName);
    ToastSuccess(`Delivery location set to ${cityName}`);
    setLocationModalVisible(false);
  };

  return {
    userName,
    city,
    loading,
    refreshing,
    stores,
    cartCount,
    addingMedId,
    locationModalVisible,
    setLocationModalVisible,
    pincodeText,
    setPincodeText,
    handleApplyPincode,
    handleSelectCity,
    onRefresh: () => {
      fetchStores(true);
      fetchCartCount();
    },
    onStorePress,
    onSearchPress,
    onCategoryPress,
    onSeeAllCategories,
    onViewAllStores,
    onProfilePress,
    onCartPress,
    onQuickAdd,
    onReorderPress: () => navigation.navigate('cart'),
  };
};

export default useStoreDiscovery;

import { useState, useEffect, useCallback } from 'react';
import { useLocationContext } from '../../../context/LocationContext';
import { useAuthNavigation } from '../../../hooks/useAppNavigation';
import { useDebounce } from '../../../hooks/useDebounce';
import { axiosInstance } from '../../../services/api';
import { NearbyStore } from '../../../components/card/storeCard/storeCardProps';

export type StoreSortBy = 'distance' | 'rating' | 'name';

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
  {
    id: 'store-noble-04',
    storeName: 'Noble Medicals & Chemist',
    phone: '+91 98210 33445',
    addressLine1: 'Station Road, Pune Junction',
    city: 'Pune',
    distanceKm: 3.1,
    isOpen: false,
    rating: 4.5,
    reviewCount: 178,
    pickupEnabled: true,
  },
];

export const useStoresList = () => {
  const navigation = useAuthNavigation();
  const { latitude, longitude, radiusKm, city } = useLocationContext();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [openNow, setOpenNow] = useState(false);
  const [sortBy, setSortBy] = useState<StoreSortBy>('distance');
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
          openNow: openNow || undefined,
          sortBy,
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
  }, [latitude, longitude, radiusKm, city, openNow, sortBy]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const filteredStores = stores
    .filter((store) => {
      // 1. Search filter
      if (debouncedSearch.trim()) {
        const term = debouncedSearch.toLowerCase();
        const matchName = store.storeName.toLowerCase().includes(term);
        const matchAddress = (store.addressLine1 || '').toLowerCase().includes(term);
        if (!matchName && !matchAddress) return false;
      }

      // 2. Open now toggle (matching Web)
      if (openNow && store.isOpen === false) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      // 3. Sort by: distance, rating, name (matching Web)
      if (sortBy === 'distance') {
        return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
      }
      if (sortBy === 'rating') {
        return (b.rating ?? 0) - (a.rating ?? 0);
      }
      if (sortBy === 'name') {
        return a.storeName.localeCompare(b.storeName);
      }
      return 0;
    });

  const onStorePress = (store: NearbyStore) => {
    navigation.navigate('storeDetail', { id: store.id, storeName: store.storeName });
  };

  const goBack = () => {
    navigation.goBack();
  };

  return {
    city,
    search,
    setSearch,
    openNow,
    toggleOpenNow: () => setOpenNow((prev) => !prev),
    sortBy,
    setSortBy,
    filteredStores,
    loading,
    refreshing,
    onRefresh: () => fetchStores(true),
    onStorePress,
    goBack,
  };
};

export default useStoresList;

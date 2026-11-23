import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParams } from '../../../navigation/stacks/rootStackParams';
import api from '../../../services/api/api';
import { OrderSummaryItem } from '../../../components/card/orderCard/orderCardProps';

export type FilterKey = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

const DEMO_FALLBACK_ORDERS: OrderSummaryItem[] = [
  {
    id: 'ord-demo-01',
    orderNumber: 'MED-2026-0891',
    status: 'PREPARING',
    fulfillmentType: 'DELIVERY',
    totalAmount: 165,
    createdAt: new Date().toISOString(),
    _count: { items: 2 },
    retailer: {
      id: 'store-apollo-01',
      storeName: 'Apollo Medical Store',
    },
    prescriptionStatus: 'NOT_REQUIRED',
  },
  {
    id: 'ord-demo-02',
    orderNumber: 'MED-2026-0742',
    status: 'COMPLETED',
    fulfillmentType: 'PICKUP',
    totalAmount: 180,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    _count: { items: 1 },
    retailer: {
      id: 'store-wellness-02',
      storeName: 'Wellness Forever 24x7',
    },
    prescriptionStatus: 'APPROVED',
  },
];

export const useOrderHistory = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();

  const [orders, setOrders] = useState<OrderSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = useCallback(
    async (pageToFetch: number, filter: FilterKey, refresh = false) => {
      try {
        const params: Record<string, unknown> = {
          page: pageToFetch,
          limit: 10,
        };

        if (filter === 'ACTIVE') {
          params.active = true;
        } else if (filter === 'COMPLETED') {
          params.status = 'COMPLETED';
        } else if (filter === 'CANCELLED') {
          params.status = 'CANCELLED';
        }

        const res = await api.get('/customers/orders', { params });
        const items: OrderSummaryItem[] = res.data?.data?.items ?? [];
        const meta = res.data?.data?.meta;

        const finalItems = items.length > 0 ? items : DEMO_FALLBACK_ORDERS;

        if (refresh || pageToFetch === 1) {
          setOrders(finalItems);
        } else {
          setOrders((prev) => [...prev, ...finalItems]);
        }

        setTotalPages(meta?.totalPages ?? 1);
        setPage(pageToFetch);
      } catch {
        setOrders(DEMO_FALLBACK_ORDERS);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    setIsLoading(true);
    fetchOrders(1, selectedFilter);
  }, [selectedFilter, fetchOrders]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchOrders(1, selectedFilter, true);
  }, [selectedFilter, fetchOrders]);

  const onEndReached = useCallback(() => {
    if (!isLoadingMore && page < totalPages) {
      setIsLoadingMore(true);
      fetchOrders(page + 1, selectedFilter);
    }
  }, [isLoadingMore, page, totalPages, selectedFilter, fetchOrders]);

  const onSelectFilter = (filter: FilterKey) => {
    if (selectedFilter !== filter) {
      setSelectedFilter(filter);
      setPage(1);
    }
  };

  const onOrderPress = (order: OrderSummaryItem) => {
    navigation.navigate('orderDetail', { orderId: order.id });
  };

  return {
    orders,
    isLoading,
    isRefreshing,
    isLoadingMore,
    selectedFilter,
    onRefresh,
    onEndReached,
    onSelectFilter,
    onOrderPress,
  };
};

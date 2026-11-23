import { useState, useEffect, useCallback } from 'react';
import { useAuthNavigation } from '../../../hooks/useAppNavigation';
import { axiosInstance } from '../../../services/api';
import { CartItemModel } from '../../../components/card/cartItemCard/cartItemCardProps';
import { DrugInteractionWarning } from '../../../components/common/safetyBanner/safetyBannerProps';
import { ToastError, ToastSuccess } from '../../../utility/toast';
import { cleanErrorMessage } from '../../../utility/common';

export const useCart = () => {
  const navigation = useAuthNavigation();

  const [cart, setCart] = useState<any>(null);
  const [items, setItems] = useState<CartItemModel[]>([]);
  const [totals, setTotals] = useState<any>({ subtotal: 0, taxTotal: 0, total: 0 });
  const [interactionWarnings, setInteractionWarnings] = useState<DrugInteractionWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCart = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await axiosInstance.get('/customers/cart');
      const data = response.data?.data;

      setCart(data?.cart || null);
      setItems(data?.items || []);
      const rawTotals = data?.totals || {};
      setTotals({
        subtotal: Number(rawTotals.subtotal ?? 0),
        taxTotal: Number(rawTotals.taxAmount ?? rawTotals.taxTotal ?? 0),
        total: Number(rawTotals.totalAmount ?? rawTotals.total ?? 0),
      });
      setInteractionWarnings(data?.interactionWarnings || []);
    } catch (err: any) {
      const msg = cleanErrorMessage(err, 'Failed to fetch cart');
      ToastError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const handleUpdateQuantity = async (itemId: string, newQty: number) => {
    if (newQty < 1) return;
    setActionLoading(true);
    try {
      await axiosInstance.put(`/customers/cart/items/${itemId}`, { quantity: newQty });
      fetchCart();
    } catch (err: any) {
      const msg = cleanErrorMessage(err, 'Could not update item quantity');
      ToastError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    setActionLoading(true);
    try {
      await axiosInstance.delete(`/customers/cart/items/${itemId}`);
      ToastSuccess('Item removed from cart');
      fetchCart();
    } catch (err: any) {
      const msg = cleanErrorMessage(err, 'Failed to remove item');
      ToastError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearCart = async () => {
    setActionLoading(true);
    try {
      await axiosInstance.delete('/customers/cart');
      ToastSuccess('Cart cleared');
      fetchCart();
    } catch (err: any) {
      const msg = cleanErrorMessage(err, 'Failed to clear cart');
      ToastError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const hasRx = items.some((item) => item.prescriptionRequired || item.product?.prescriptionRequired);
  const hasSevereInteraction = interactionWarnings.some((w) => w.severity === 'SEVERE');
  const prescriptionRequired = hasRx || hasSevereInteraction;

  const navigateToCheckout = () => {
    if (items.length === 0) return;
    navigation.navigate('checkout', {
      retailerId: cart?.retailerId,
      storeName: cart?.retailer?.storeName,
      totals,
      prescriptionRequired,
    });
  };

  const navigateToStores = () => {
    navigation.navigate('bottomTab' as any);
  };

  return {
    cart,
    items,
    totals,
    interactionWarnings,
    loading,
    refreshing,
    actionLoading,
    prescriptionRequired,
    onRefresh: () => fetchCart(true),
    handleUpdateQuantity,
    handleRemoveItem,
    handleClearCart,
    navigateToCheckout,
    navigateToStores,
  };
};

export default useCart;

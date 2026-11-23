import { useState, useEffect, useCallback } from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFormik } from 'formik';
import { RootStackParams } from '../../../navigation/stacks/rootStackParams';
import { OrderDetailRouteProp } from './orderDetailProps';
import api from '../../../services/api/api';
import { ToastError, ToastSuccess, Toast } from '../../../utility/toast';
import { initialValues, formSchema } from './orderDetail.formik';

export interface OrderDetailData {
  id: string;
  orderNumber: string;
  status: string;
  fulfillmentType: 'PICKUP' | 'DELIVERY';
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  deliveryFee: number;
  paymentMode: string;
  paymentStatus: string;
  prescriptionStatus: string;
  prescriptionUrl?: string | null;
  customerNote?: string | null;
  createdAt: string;
  retailer?: {
    id: string;
    storeName: string;
    phone: string;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
    gstNumber?: string;
  };
  pickupSlot?: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
  } | null;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    product?: {
      id: string;
      name: string;
      packSize?: string;
      prescriptionRequired?: boolean;
    };
    allocations?: Array<{
      batch?: {
        batchNumber: string;
        expiryDate: string;
      };
    }>;
  }>;
  statusHistory?: Array<{
    id: string;
    status: string;
    note?: string | null;
    createdAt: string;
  }>;
}

const CANCELLABLE_STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING'];

const DEMO_ORDER_DETAIL: OrderDetailData = {
  id: 'ord-demo-01',
  orderNumber: 'MED-2026-0891',
  status: 'PREPARING',
  fulfillmentType: 'DELIVERY',
  subtotal: 145,
  taxAmount: 20,
  deliveryFee: 0,
  discountAmount: 0,
  totalAmount: 165,
  paymentMode: 'CASH',
  paymentStatus: 'PENDING',
  prescriptionStatus: 'APPROVED',
  prescriptionUrl: null,
  customerNote: 'Please deliver between 4 PM to 6 PM',
  createdAt: new Date().toISOString(),
  retailer: {
    id: 'store-apollo-01',
    storeName: 'Apollo Medical Store',
    phone: '+91 98230 11223',
    addressLine1: 'Shop 1, Main Market Road',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    gstNumber: '27AABCA1234F1Z5',
  },
  pickupSlot: null,
  items: [
    {
      id: 'item-01',
      productName: 'Dolo 650mg Tablet',
      quantity: 1,
      unitPrice: 30,
      totalAmount: 30,
      product: {
        id: 'prod-dolo-650',
        name: 'Dolo 650mg Tablet',
        packSize: '15 Tablets in Strip',
        prescriptionRequired: false,
      },
      allocations: [
        {
          batch: {
            batchNumber: 'DL65-992',
            expiryDate: '2028-06-30',
          },
        },
      ],
    },
    {
      id: 'item-02',
      productName: 'Pan-D Capsule',
      quantity: 1,
      unitPrice: 135,
      totalAmount: 135,
      product: {
        id: 'prod-pan-d',
        name: 'Pan-D Capsule',
        packSize: '10 Capsules in Strip',
        prescriptionRequired: true,
      },
      allocations: [
        {
          batch: {
            batchNumber: 'PAND-881',
            expiryDate: '2027-11-30',
          },
        },
      ],
    },
  ],
  statusHistory: [
    {
      id: 'sh-01',
      status: 'PENDING',
      note: 'Order placed by customer',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'sh-02',
      status: 'CONFIRMED',
      note: 'Prescription & stock verified by licensed pharmacist',
      createdAt: new Date(Date.now() - 2400000).toISOString(),
    },
    {
      id: 'sh-03',
      status: 'PREPARING',
      note: 'Pharmacist packing medicines from batch DL65-992 & PAND-881',
      createdAt: new Date(Date.now() - 1200000).toISOString(),
    },
  ],
};

export const useOrderDetail = () => {
  const route = useRoute<OrderDetailRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const orderId = route.params?.orderId;

  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const fetchOrderDetail = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await api.get(`/customers/orders/${orderId}`);
      setOrder(res.data?.data || DEMO_ORDER_DETAIL);
    } catch {
      setOrder(DEMO_ORDER_DETAIL);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderDetail();
  }, [fetchOrderDetail]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchOrderDetail();
  };

  const cancelFormik = useFormik({
    initialValues,
    validationSchema: formSchema,
    onSubmit: async (values, { resetForm, setSubmitting }) => {
      if (!orderId) return;
      try {
        setSubmitting(true);
        await api.post(`/customers/orders/${orderId}/cancel`, {
          reason: values.reason,
        });
        ToastSuccess('Order cancelled successfully');
        setCancelModalVisible(false);
        resetForm();
        fetchOrderDetail();
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        ToastError(error.response?.data?.message || 'Failed to cancel order');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const onReorder = async () => {
    if (!orderId) return;
    try {
      setIsReordering(true);
      const res = await api.post(`/customers/orders/${orderId}/reorder`, {
        replaceCart: true,
      });
      ToastSuccess(res.data?.message || 'Added to cart');
      navigation.navigate('cart');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      ToastError(error.response?.data?.message || 'Failed to reorder');
    } finally {
      setIsReordering(false);
    }
  };

  const onDownloadInvoice = async () => {
    if (!orderId) return;
    try {
      const res = await api.get(`/customers/orders/${orderId}/invoice`);
      const inv = res.data?.data;
      Toast(`Invoice #${inv?.invoiceNumber ?? 'Loaded'}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      Toast(
        error.response?.data?.message ||
          'Invoice not available yet — generated once order is fulfilled',
      );
    }
  };

  const isCancellable = order ? CANCELLABLE_STATUSES.includes(order.status) : false;

  return {
    order,
    isLoading,
    isRefreshing,
    cancelModalVisible,
    setCancelModalVisible,
    cancelFormik,
    isCancellable,
    isReordering,
    onRefresh,
    onReorder,
    onDownloadInvoice,
    goBack: () => navigation.goBack(),
  };
};

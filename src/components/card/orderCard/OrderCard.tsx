import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { OrderCardProps } from './orderCardProps';
import { styles } from './orderCard.style';
import { StoreIcon } from '../../../assets/svg/StoreIcon';
import { color } from '@theme';

export const getOrderStatusInfo = (status: string): {
  label: string;
  bg: string;
  text: string;
} => {
  switch (status) {
    case 'PENDING':
      return { label: 'Placed', bg: color.warningLight, text: color.warning };
    case 'ACCEPTED':
      return { label: 'Confirmed', bg: color.infoLight, text: color.info };
    case 'PREPARING':
      return { label: 'Preparing', bg: color.infoLight, text: color.info };
    case 'READY_FOR_PICKUP':
      return { label: 'Ready for Pickup', bg: color.primaryLight, text: color.primary };
    case 'PICKED_UP':
    case 'DELIVERED':
    case 'COMPLETED':
      return { label: 'Completed', bg: color.successLight, text: color.success };
    case 'OUT_FOR_DELIVERY':
      return { label: 'Out for Delivery', bg: color.primaryLight, text: color.primary };
    case 'CANCELLED':
      return { label: 'Cancelled', bg: color.errorLight, text: color.error };
    case 'REJECTED':
      return { label: 'Rejected', bg: color.errorLight, text: color.error };
    case 'EXPIRED':
      return { label: 'Expired', bg: color.errorLight, text: color.error };
    default:
      return { label: status, bg: color.infoLight, text: color.info };
  }
};

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

export const OrderCard: React.FC<OrderCardProps> = ({ order, onPress }) => {
  const statusInfo = getOrderStatusInfo(order.status);
  const itemCount = order._count?.items ?? order.items?.length ?? 0;
  const itemsSummary = order.items
    ?.map((i) => `${i.productName} (x${i.quantity})`)
    .join(', ');

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.card}
      onPress={() => onPress(order)}
    >
      <View style={styles.header}>
        <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Text style={[styles.statusText, { color: statusInfo.text }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      <Text style={styles.dateText}>{formatDate(order.createdAt)}</Text>

      {order.retailer?.storeName ? (
        <View style={styles.storeRow}>
          <StoreIcon width={14} height={14} color={color.textSecondary} />
          <Text style={styles.storeName} numberOfLines={1}>
            {order.retailer.storeName}
          </Text>
        </View>
      ) : null}

      {itemCount > 0 ? (
        <View style={styles.itemsPreview}>
          <Text style={styles.itemsCountText}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Text>
          {itemsSummary ? (
            <Text style={styles.itemNamesText} numberOfLines={1}>
              {itemsSummary}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.fulfillmentBadge}>
          <Text style={styles.fulfillmentText}>
            {order.fulfillmentType === 'PICKUP' ? 'Store Pickup' : 'Home Delivery'}
          </Text>
        </View>
        <Text style={styles.totalAmount}>
          ₹{Number(order.totalAmount ?? 0).toFixed(2)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default OrderCard;

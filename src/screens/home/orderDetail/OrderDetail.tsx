import React from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOrderDetail } from './useOrderDetail';
import { styles } from './orderDetail.style';
import Header from '../../../components/common/header/Header';
import Loader from '../../../components/common/loader/Loader';
import Button from '../../../components/common/button/Button';
import Input from '../../../components/common/input/Input';
import OrderStepper from '../../../components/common/orderStepper/OrderStepper';
import { getOrderStatusInfo } from '../../../components/card/orderCard/OrderCard';
import { StoreIcon } from '../../../assets/svg/StoreIcon';
import { color } from '@theme';

export const OrderDetail: React.FC = () => {
  const {
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
    goBack,
  } = useOrderDetail();

  if (isLoading || !order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Order Details" showBack onBackPress={goBack} />
        <Loader message="Loading order details..." />
      </SafeAreaView>
    );
  }

  const statusInfo = getOrderStatusInfo(order.status);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title={`#${order.orderNumber}`}
        showBack
        onBackPress={goBack}
        rightComponent={
          <View
            style={[
              styles.statusBadge,
              styles.headerBadge,
              { backgroundColor: statusInfo.bg },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: statusInfo.text }]}>
              {statusInfo.label}
            </Text>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[color.primary]}
            tintColor={color.primary}
          />
        }
      >
        {/* Status Stepper */}
        <OrderStepper
          currentStatus={order.status}
          fulfillmentType={order.fulfillmentType}
          history={order.statusHistory}
        />

        {/* Pharmacy Store Card */}
        {order.retailer ? (
          <View style={styles.card}>
            <View style={styles.storeRow}>
              <StoreIcon width={18} height={18} color={color.primary} />
              <Text style={styles.storeName}>{order.retailer.storeName}</Text>
            </View>
            <Text style={styles.storeDetailText}>
              {order.retailer.addressLine1}, {order.retailer.city},{' '}
              {order.retailer.state} - {order.retailer.pincode}
            </Text>
            <Text style={styles.storeDetailText}>
              Phone: {order.retailer.phone}
            </Text>
          </View>
        ) : null}

        {/* Fulfillment & Prescription */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fulfillment Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Delivery Type</Text>
            <Text style={styles.infoValue}>
              {order.fulfillmentType === 'PICKUP' ? 'Store Pickup' : 'Home Delivery'}
            </Text>
          </View>

          {order.pickupSlot ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pickup Window</Text>
              <Text style={styles.infoValue}>
                {new Date(order.pickupSlot.date).toLocaleDateString()} (
                {order.pickupSlot.startTime} - {order.pickupSlot.endTime})
              </Text>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Prescription Status</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    order.prescriptionStatus === 'APPROVED'
                      ? color.successLight
                      : order.prescriptionStatus === 'REJECTED'
                      ? color.errorLight
                      : color.infoLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color:
                      order.prescriptionStatus === 'APPROVED'
                        ? color.success
                        : order.prescriptionStatus === 'REJECTED'
                        ? color.error
                        : color.info,
                  },
                ]}
              >
                {order.prescriptionStatus}
              </Text>
            </View>
          </View>

          {order.customerNote ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Note</Text>
              <Text style={styles.infoValue}>{order.customerNote}</Text>
            </View>
          ) : null}
        </View>

        {/* Order Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Items ({order.items.length})</Text>
          {order.items.map((item) => {
            const batch = item.allocations?.[0]?.batch;
            return (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>
                    {item.productName || item.product?.name}
                  </Text>
                  {item.product?.packSize ? (
                    <Text style={styles.itemSubtext}>
                      Pack: {item.product.packSize}
                    </Text>
                  ) : null}
                  {batch?.batchNumber ? (
                    <Text style={styles.itemSubtext}>
                      Batch: {batch.batchNumber}
                      {batch.expiryDate
                        ? ` (Exp: ${new Date(batch.expiryDate).toLocaleDateString()})`
                        : ''}
                    </Text>
                  ) : null}
                  <Text style={styles.itemSubtext}>
                    Qty: {item.quantity} × ₹{item.unitPrice?.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.itemPrice}>
                  ₹{item.totalAmount?.toFixed(2)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Payment & Bill Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bill Summary</Text>
          <View style={styles.totalRow}>
            <Text style={styles.infoLabel}>Subtotal</Text>
            <Text style={styles.infoValue}>₹{order.subtotal?.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.infoLabel}>Taxes & GST</Text>
            <Text style={styles.infoValue}>₹{order.taxAmount?.toFixed(2)}</Text>
          </View>
          {order.deliveryFee > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.infoLabel}>Delivery Fee</Text>
              <Text style={styles.infoValue}>
                ₹{order.deliveryFee?.toFixed(2)}
              </Text>
            </View>
          ) : null}
          {order.discountAmount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.infoLabel}>Discount</Text>
              <Text style={styles.infoValue}>
                -₹{order.discountAmount?.toFixed(2)}
              </Text>
            </View>
          ) : null}

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Paid</Text>
            <Text style={styles.grandTotalValue}>
              ₹{order.totalAmount?.toFixed(2)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment Mode</Text>
            <Text style={styles.infoValue}>{order.paymentMode}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment Status</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    order.paymentStatus === 'PAID'
                      ? color.successLight
                      : color.warningLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color:
                      order.paymentStatus === 'PAID'
                        ? color.success
                        : color.warning,
                  },
                ]}
              >
                {order.paymentStatus}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <Button
            title="Repeat Order"
            onPress={onReorder}
            loading={isReordering}
          />

          <Button
            title="View Invoice"
            variant="outline"
            onPress={onDownloadInvoice}
          />

          {isCancellable ? (
            <Button
              title="Cancel Order"
              variant="outline"
              style={styles.cancelButton}
              textStyle={styles.cancelButtonText}
              onPress={() => setCancelModalVisible(true)}
            />
          ) : null}
        </View>
      </ScrollView>

      {/* Cancel Order Modal */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel Order</Text>
            <Text style={styles.modalSubtitle}>
              Please tell us why you want to cancel this order.
            </Text>

            <Input
              label="Cancellation Reason"
              placeholder="e.g. Ordered by mistake, found alternative"
              value={cancelFormik.values.reason}
              onChangeText={cancelFormik.handleChange('reason')}
              onBlur={cancelFormik.handleBlur('reason')}
              error={
                cancelFormik.touched.reason
                  ? cancelFormik.errors.reason
                  : undefined
              }
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <Button
                title="Keep Order"
                variant="outline"
                style={styles.modalBtn}
                onPress={() => setCancelModalVisible(false)}
              />
              <Button
                title="Confirm Cancel"
                variant="primary"
                style={styles.modalBtn}
                loading={cancelFormik.isSubmitting}
                onPress={() => cancelFormik.handleSubmit()}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default OrderDetail;

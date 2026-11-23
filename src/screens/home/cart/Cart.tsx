import React from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './cart.style';
import useCart from './useCart';
import { Header, Button, Loader, SafetyBanner } from '../../../components/componentsIndex';
import { CartItemCard } from '../../../components/cardIndex';
import { CartIcon } from '../../../assets/svg/CartIcon';
import { formatCurrency } from '../../../utility/common';
import color from '../../../theme/color';

export const Cart: React.FC = () => {
  const {
    cart,
    items,
    totals,
    interactionWarnings,
    loading,
    refreshing,
    actionLoading,
    prescriptionRequired,
    onRefresh,
    handleUpdateQuantity,
    handleRemoveItem,
    handleClearCart,
    navigateToCheckout,
    navigateToStores,
  } = useCart();

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Shopping Cart" showBack={false} />
        <Loader message="Loading your cart..." />
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Shopping Cart" showBack={false} />
        <View style={styles.emptyBox}>
          <CartIcon width={64} height={64} color={color.textDisabled} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Browse nearby medical stores to add medicines and healthcare essentials.
          </Text>
          <Button
            title="Browse Pharmacies"
            onPress={navigateToStores}
            style={styles.browseBtn}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Shopping Cart" showBack={false} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={color.primary}
          />
        }
      >
        {/* Active Pharmacy Store Bar */}
        <View style={styles.storeBar}>
          <View style={styles.storeInfo}>
            <Text style={styles.storeLabel}>Ordering from store:</Text>
            <Text style={styles.storeName}>
              {cart?.retailer?.storeName || 'Selected Medical Shop'}
            </Text>
          </View>

          <TouchableOpacity onPress={handleClearCart} activeOpacity={0.7}>
            <Text style={styles.clearCartText}>Clear Cart</Text>
          </TouchableOpacity>
        </View>

        {/* Clinical Drug-Drug Safety Warning Matrix */}
        <SafetyBanner warnings={interactionWarnings} />

        {/* Cart Item Cards */}
        <Text style={styles.sectionTitle}>Order Items ({items.length})</Text>
        {items.map((item) => (
          <CartItemCard
            key={item.id}
            item={item}
            onIncrement={() => handleUpdateQuantity(item.id, item.quantity + 1)}
            onDecrement={() => handleUpdateQuantity(item.id, item.quantity - 1)}
            onRemove={() => handleRemoveItem(item.id)}
            loading={actionLoading}
          />
        ))}

        {/* Bill Summary Breakdown */}
        <View style={styles.billCard}>
          <Text style={styles.billTitle}>Bill Summary</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Subtotal</Text>
            <Text style={styles.billValue}>{formatCurrency(totals.subtotal)}</Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>GST / Estimated Tax</Text>
            <Text style={styles.billValue}>{formatCurrency(totals.taxTotal)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.billRow}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(totals.total)}</Text>
          </View>
        </View>

        {/* Checkout CTA */}
        <Button
          title={
            prescriptionRequired
              ? 'Proceed to Checkout (Rx Required)'
              : 'Proceed to Checkout'
          }
          onPress={navigateToCheckout}
          style={styles.checkoutBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default Cart;

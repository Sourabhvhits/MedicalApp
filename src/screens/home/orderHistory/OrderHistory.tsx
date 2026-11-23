import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOrderHistory, FilterKey } from './useOrderHistory';
import { styles } from './orderHistory.style';
import Header from '../../../components/common/header/Header';
import OrderCard from '../../../components/card/orderCard/OrderCard';
import Loader from '../../../components/common/loader/Loader';
import { ClockIcon } from '../../../assets/svg/ClockIcon';
import { color } from '@theme';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'All Orders' },
  { key: 'ACTIVE', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Delivered / Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export const OrderHistory: React.FC = () => {
  const {
    orders,
    isLoading,
    isRefreshing,
    isLoadingMore,
    selectedFilter,
    onRefresh,
    onEndReached,
    onSelectFilter,
    onOrderPress,
  } = useOrderHistory();

  const renderFooter = () => {
    if (!isLoadingMore) return undefined;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={color.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return undefined;
    return (
      <View style={styles.emptyContainer}>
        <ClockIcon width={48} height={48} color={color.textMuted} />
        <Text style={styles.emptyTitle}>No Orders Found</Text>
        <Text style={styles.emptySubtitle}>
          {selectedFilter === 'ALL'
            ? 'You have not placed any orders yet.'
            : `No ${selectedFilter.toLowerCase()} orders found.`}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="My Orders" />

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTERS.map((f) => {
            const isActive = selectedFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => onSelectFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <Loader message="Loading your orders..." />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderCard order={item} onPress={onOrderPress} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[color.primary]}
              tintColor={color.primary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={renderFooter()}
          ListEmptyComponent={renderEmpty()}
        />
      )}
    </SafeAreaView>
  );
};

export default OrderHistory;

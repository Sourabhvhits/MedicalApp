import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './storeDetail.style';
import useStoreDetail from './useStoreDetail';
import { Header, Input, Loader } from '../../../components/componentsIndex';
import { ProductCard } from '../../../components/cardIndex';
import { LocationPinIcon } from '../../../assets/svg/LocationPinIcon';
import { PhoneIcon } from '../../../assets/svg/PhoneIcon';
import { ClockIcon } from '../../../assets/svg/ClockIcon';
import { SearchIcon } from '../../../assets/svg/SearchIcon';
import color from '../../../theme/color';

export const StoreDetail: React.FC = () => {
  const {
    storeName,
    store,
    products,
    loading,
    searchQuery,
    setSearchQuery,
    handleAddToCart,
    goBack,
  } = useStoreDetail();

  const isOpen = store?.isOpen !== false;

  return (
    <SafeAreaView style={styles.container}>
      <Header title={storeName || 'Pharmacy Store'} showBack onBackPress={goBack} />

      {/* Store Banner Hero Card */}
      <View style={styles.storeHeroCard}>
        <View style={styles.storeTitleRow}>
          <Text style={styles.storeName}>{store?.storeName || storeName}</Text>
          <View
            style={[
              styles.statusBadge,
              isOpen ? styles.statusOpen : styles.statusClosed,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isOpen ? styles.statusOpenText : styles.statusClosedText,
              ]}
            >
              {isOpen ? 'OPEN' : 'CLOSED'}
            </Text>
          </View>
        </View>

        {store?.addressLine1 ? (
          <View style={styles.storeMetaRow}>
            <LocationPinIcon width={14} height={14} color={color.textSecondary} />
            <Text style={styles.metaText}>{store.addressLine1}</Text>
          </View>
        ) : null}

        {store?.phone ? (
          <View style={styles.storeMetaRow}>
            <PhoneIcon width={14} height={14} color={color.textSecondary} />
            <Text style={styles.metaText}>{store.phone}</Text>
          </View>
        ) : null}

        <View style={styles.pickupHighlight}>
          <ClockIcon width={16} height={16} color={color.primary} />
          <Text style={styles.pickupHighlightText}>
            Order Online • Collect in store in 15–30 minutes
          </Text>
        </View>
      </View>

      {/* Live Store Medicine Search Bar */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search medicines in this store..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<SearchIcon width={18} height={18} color={color.textSecondary} />}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>In-Stock Medicines</Text>
        <Text style={styles.productCount}>{products.length} items</Text>
      </View>

      {/* Medicines list */}
      {loading ? (
        <Loader message="Loading store catalog..." />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onAddToCart={() => handleAddToCart(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No medicines found in this store</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default StoreDetail;

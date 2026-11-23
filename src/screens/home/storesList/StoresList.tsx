import React from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './storesList.style';
import useStoresList, { StoreSortBy } from './useStoresList';
import { Header, Loader } from '../../../components/componentsIndex';
import { StoreCard } from '../../../components/cardIndex';
import { SearchIcon } from '../../../assets/svg/SearchIcon';
import { StoreIcon } from '../../../assets/svg/StoreIcon';
import { color } from '@theme';

const SORT_OPTIONS: { key: StoreSortBy; label: string }[] = [
  { key: 'distance', label: 'Nearest' },
  { key: 'rating', label: 'Top rated' },
  { key: 'name', label: 'A to Z' },
];

export const StoresList: React.FC = () => {
  const {
    city,
    search,
    setSearch,
    openNow,
    toggleOpenNow,
    sortBy,
    setSortBy,
    filteredStores,
    loading,
    refreshing,
    onRefresh,
    onStorePress,
    goBack,
  } = useStoresList();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Header
        title={`Pharmacies in ${city || 'Pune'}`}
        showBack
        onBackPress={goBack}
      />

      {/* Store Search Input (matching Web) */}
      <View style={styles.headerSearchWrapper}>
        <View style={styles.searchBar}>
          <SearchIcon width={18} height={18} color={color.textSecondary} />
          <TextInput
            placeholder="Search stores by name or area"
            placeholderTextColor={color.textMuted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Filter & Sort Chips (matching Web exactly: Open now button + Sort by Nearest/Top rated/A to Z) */}
      <View style={styles.filterScrollWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {/* Open Now toggle matching Web Button */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              openNow ? styles.filterChipActive : styles.filterChipInactive,
            ]}
            onPress={toggleOpenNow}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.filterChipText,
                openNow ? styles.filterChipTextActive : styles.filterChipTextInactive,
              ]}
            >
              {openNow ? '✓ Open now' : 'Open now'}
            </Text>
          </TouchableOpacity>

          {/* Sort By options matching Web Select */}
          {SORT_OPTIONS.map((item) => {
            const isActive = sortBy === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.filterChip,
                  isActive ? styles.filterChipActive : styles.filterChipInactive,
                ]}
                onPress={() => setSortBy(item.key)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive ? styles.filterChipTextActive : styles.filterChipTextInactive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Stores List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={color.primary}
            colors={[color.primary]}
          />
        }
      >
        <Text style={styles.resultsCount}>
          Showing {filteredStores.length} licensed stores near you
        </Text>

        {loading && !refreshing ? (
          <Loader message="Loading pharmacies..." />
        ) : filteredStores.length > 0 ? (
          filteredStores.map((store) => (
            <StoreCard
              key={store.id}
              store={store}
              onPress={() => onStorePress(store)}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <StoreIcon width={44} height={44} color={color.textDisabled} />
            <Text style={styles.emptyTitle}>No medical stores found</Text>
            <Text style={styles.emptySubtitle}>
              Try changing your search keywords or select "All Pharmacies".
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default StoresList;

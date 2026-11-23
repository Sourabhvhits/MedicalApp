import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './productSearch.style';
import useProductSearch from './useProductSearch';
import { Header, Input, Loader } from '../../../components/componentsIndex';
import { ProductCard } from '../../../components/cardIndex';
import { SearchIcon } from '../../../assets/svg/SearchIcon';
import { PillCapsuleIcon } from '../../../assets/svg/PillCapsuleIcon';
import { UserIcon } from '../../../assets/svg/UserIcon';
import color from '../../../theme/color';

const QUICK_SEARCH_CHIPS = ['Vitamin D3', 'Dolo 650', 'Pan-D', 'Calciquick', 'Paracetamol'];

export const ProductSearch: React.FC = () => {
  const {
    query,
    setQuery,
    products,
    substitutes,
    loading,
    handleAddToCart,
    goBack,
  } = useProductSearch();

  const searchedItem = products[0];
  const suggestedItem = substitutes[0];
  const hasComparison = Boolean(searchedItem && suggestedItem);

  const renderComparisonCard = () => {
    if (!hasComparison) return null;

    const composition =
      searchedItem.composition ||
      suggestedItem.composition ||
      'ACTIVE THERAPEUTIC COMPOSITION';

    return (
      <View style={styles.comparisonWrapper}>
        {/* Comparison Header */}
        <View style={styles.comparisonHeaderRow}>
          <Text style={styles.strengthText}>100% Same Strength</Text>
          <View style={styles.savePillBadge}>
            <Text style={styles.savePillText}>
              Save {suggestedItem.discountPercent || 50}% with Substitute
            </Text>
          </View>
        </View>

        {/* Salt Composition Tag */}
        <View style={styles.saltCompositionBanner}>
          <Text style={styles.saltLabel}>Salt Composition in Both</Text>
          <Text style={styles.saltValue} numberOfLines={2}>
            {composition}
          </Text>
        </View>

        {/* Side by side columns */}
        <View style={styles.comparisonColumns}>
          {/* Left Column: You Searched */}
          <View style={styles.compareCol}>
            <View style={styles.colHeaderSearched}>
              <Text style={styles.colHeaderText}>YOU SEARCHED</Text>
            </View>
            <View style={styles.colBody}>
              <View style={styles.medImageBox}>
                <PillCapsuleIcon width={24} height={24} color={color.textSecondary} />
              </View>
              <Text style={styles.medItemName} numberOfLines={2}>
                {searchedItem.name}
              </Text>
              <Text style={styles.medItemBrand} numberOfLines={1}>
                {searchedItem.brandName || searchedItem.genericName}
              </Text>
              <Text style={styles.medItemPrice}>₹{searchedItem.price}</Text>
            </View>
          </View>

          {/* Right Column: Our Suggestion */}
          <View style={styles.compareCol}>
            <View style={styles.colHeaderSuggested}>
              <Text style={styles.colHeaderText}>OUR SUGGESTION</Text>
            </View>
            <View style={styles.colBody}>
              <View style={styles.medImageBox}>
                <PillCapsuleIcon width={24} height={24} color={color.primary} />
              </View>
              <Text style={styles.medItemName} numberOfLines={2}>
                {suggestedItem.name}
              </Text>
              <Text style={styles.medItemBrand} numberOfLines={1}>
                {suggestedItem.brandName || suggestedItem.genericName}
              </Text>
              <Text style={styles.medItemPrice}>₹{suggestedItem.price}</Text>
              {suggestedItem.mrp ? (
                <Text style={styles.medItemMrp}>MRP ₹{suggestedItem.mrp}</Text>
              ) : null}
              {suggestedItem.discountPercent ? (
                <View style={styles.discountTag}>
                  <Text style={styles.discountTagText}>{suggestedItem.discountPercent}% OFF</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.addSuggestedBtn}
                onPress={() => handleAddToCart(suggestedItem)}
                activeOpacity={0.8}
              >
                <Text style={styles.addSuggestedText}>Add to Cart</Text>
              </TouchableOpacity>

              <View style={styles.socialProofRow}>
                <UserIcon width={10} height={10} color="#059669" />
                <Text style={styles.socialProofText}>4,340+ Trust This</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (loading) {
      return <Loader message="Searching medicines..." />;
    }

    if (!query.trim()) {
      return (
        <View style={styles.emptyBox}>
          <SearchIcon width={48} height={48} color={color.textDisabled} />
          <Text style={styles.emptyTitle}>Search Any Medicine</Text>
          <Text style={styles.emptySubtitle}>
            Search by brand name (e.g. Dolo, Crocin) or active composition (e.g. Paracetamol)
          </Text>

          <View style={styles.suggestedPillsRow}>
            {QUICK_SEARCH_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip}
                style={styles.suggestedPill}
                onPress={() => setQuery(chip)}
                activeOpacity={0.75}
              >
                <Text style={styles.suggestedPillText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    if (products.length === 0 && substitutes.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No medicines found</Text>
          <Text style={styles.emptySubtitle}>
            Try searching with a different salt name or brand keyword.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={products}
        keyExtractor={(item) => `main-${item.id}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {renderComparisonCard()}
            {products.length > 0 && <Text style={styles.sectionTitle}>All Results</Text>}
          </>
        }
        renderItem={({ item }) => (
          <ProductCard product={item} onAddToCart={() => handleAddToCart(item)} />
        )}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Search Medicines" showBack onBackPress={goBack} />

      <View style={styles.searchHeader}>
        <Input
          placeholder="Search by brand or chemical salt..."
          value={query}
          onChangeText={setQuery}
          autoFocus={!query}
          leftIcon={<SearchIcon width={18} height={18} color={color.primary} />}
        />
      </View>

      {renderContent()}
    </SafeAreaView>
  );
};

export default ProductSearch;

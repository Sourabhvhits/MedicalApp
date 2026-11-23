import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './storeDiscovery.style';
import useStoreDiscovery, {
  HEALTH_CATEGORIES,
  POPULAR_MEDICINES,
  HealthCategoryItem,
  EssentialMedicine,
} from './useStoreDiscovery';
import { StoreCard } from '../../../components/cardIndex';
import { Loader } from '../../../components/componentsIndex';
import { LocationPinIcon } from '../../../assets/svg/LocationPinIcon';
import { SearchIcon } from '../../../assets/svg/SearchIcon';
import { CartIcon } from '../../../assets/svg/CartIcon';
import { UserIcon } from '../../../assets/svg/UserIcon';
import { PillCapsuleIcon } from '../../../assets/svg/PillCapsuleIcon';
import { BloodDropIcon } from '../../../assets/svg/BloodDropIcon';
import { VitaminsIcon } from '../../../assets/svg/VitaminsIcon';
import { HeartPulseIcon } from '../../../assets/svg/HeartPulseIcon';
import { DropperIcon } from '../../../assets/svg/DropperIcon';
import { StethoscopeIcon } from '../../../assets/svg/StethoscopeIcon';
import { StoreIcon } from '../../../assets/svg/StoreIcon';
import { ShieldCheckIcon } from '../../../assets/svg/ShieldCheckIcon';
import { ClockIcon } from '../../../assets/svg/ClockIcon';
import { color } from '@theme';

export const StoreDiscovery: React.FC = () => {
  const {
    userName,
    city,
    loading,
    refreshing,
    stores,
    cartCount,
    addingMedId,
    locationModalVisible,
    setLocationModalVisible,
    pincodeText,
    setPincodeText,
    handleApplyPincode,
    handleSelectCity,
    onRefresh,
    onStorePress,
    onSearchPress,
    onCategoryPress,
    onSeeAllCategories,
    onViewAllStores,
    onProfilePress,
    onCartPress,
    onQuickAdd,
    onReorderPress,
  } = useStoreDiscovery();

  const renderCategoryIcon = (type: HealthCategoryItem['type']) => {
    switch (type) {
      case 'DIABETES':
        return <BloodDropIcon width={26} height={26} color="#0284C7" />;
      case 'DIGESTIVE':
        return <PillCapsuleIcon width={26} height={26} color="#D97706" />;
      case 'HEART':
        return <HeartPulseIcon width={26} height={26} color="#EF4444" />;
      case 'RESPIRATORY':
        return <DropperIcon width={26} height={26} color="#0284C7" />;
      case 'KIDNEY':
        return <StethoscopeIcon width={26} height={26} color="#7C3AED" />;
      case 'JOINTS':
        return <HeartPulseIcon width={26} height={26} color="#059669" />;
      case 'PAIN':
        return <PillCapsuleIcon width={26} height={26} color="#EF4444" />;
      case 'VITAMINS':
        return <VitaminsIcon width={26} height={26} color="#D97706" />;
      default:
        return <StethoscopeIcon width={26} height={26} color={color.primary} />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. Top Header Section (matching reference UI) */}
      <View style={styles.topHeader}>
        <View style={styles.greetingCol}>
          <Text style={styles.helloGreeting}>Hello,</Text>
          <Text style={styles.patientName}>{userName}</Text>
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => setLocationModalVisible(true)}
            activeOpacity={0.7}
          >
            <LocationPinIcon width={13} height={13} color={color.primary} />
            <Text style={styles.locationText}>Delivering to </Text>
            <Text style={styles.locationCityBold}>{city || 'Pune'} ▾</Text>
          </TouchableOpacity>
        </View>

        {/* Right White Pill Capsule Container (Cart + Profile Avatar) */}
        <View style={styles.pillCapsule}>
          <TouchableOpacity
            style={styles.cartCapsuleBtn}
            onPress={onCartPress}
            activeOpacity={0.75}
            accessibilityLabel={`Cart with ${cartCount} items`}
          >
            <CartIcon width={20} height={20} color={color.textPrimary} />
            {cartCount > 0 && <View style={styles.redDotBadge} />}
          </TouchableOpacity>

          <View style={styles.pillDivider} />

          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={onProfilePress}
            activeOpacity={0.75}
          >
            <View style={styles.avatarCircle}>
              <UserIcon width={18} height={18} color={color.primary} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Clean Spacious Search Bar (matching reference UI) */}
      <View style={styles.searchContainer}>
        <TouchableOpacity
          style={styles.searchBarCard}
          onPress={onSearchPress}
          activeOpacity={0.85}
        >
          <SearchIcon width={19} height={19} color={color.textSecondary} />
          <Text style={styles.searchPlaceholder} numberOfLines={1}>
            Search medicines, salts, medical shops...
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
        {/* Sleek Promotional Hero Card (Card Type) */}
        <View style={styles.heroBannerContainer}>
          <TouchableOpacity
            style={styles.heroPromoCard}
            onPress={() => onCategoryPress('generic')}
            activeOpacity={0.88}
          >
            <View style={styles.promoContentCol}>
              <View style={styles.promoBadge}>
                <ShieldCheckIcon width={12} height={12} color="#5EEAD4" />
                <Text style={styles.promoBadgeText}>GENERIC SAVINGS PROMISE</Text>
              </View>
              <Text style={styles.promoTitle}>Save up to 60% on Medicines</Text>
              <Text style={styles.promoSubtitle}>
                100% same active salt composition & clinical efficacy from certified labs.
              </Text>
              <View style={styles.promoCtaBtn}>
                <Text style={styles.promoCtaText}>Compare & Save →</Text>
              </View>
            </View>

            <View style={styles.promoGraphicCol}>
              <View style={styles.discountCircleBadge}>
                <Text style={styles.discountCirclePercent}>60%</Text>
                <Text style={styles.discountCircleOff}>OFF</Text>
              </View>
              <Text style={styles.discountCircleSub}>On Generics</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 3. Categories Section (matching reference UI circular items) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <TouchableOpacity onPress={onSeeAllCategories} activeOpacity={0.7}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {HEALTH_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={styles.categoryItem}
              onPress={() => onCategoryPress(cat.query)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.categoryCircle,
                  { backgroundColor: cat.bgColor },
                ]}
              >
                {renderCategoryIcon(cat.type)}
              </View>
              <Text style={styles.categoryLabel} numberOfLines={1}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Quick Reorder Strip for Returning Customer */}
        <View style={styles.recentOrderSection}>
          <View style={styles.recentOrderCard}>
            <View style={styles.recentOrderLeft}>
              <View style={styles.recentOrderTagRow}>
                <ClockIcon width={12} height={12} color={color.primary} />
                <Text style={styles.recentOrderTag}>Previous Order</Text>
              </View>
              <Text style={styles.recentOrderTitle}>Dolo 650mg + Pan-D (2 items)</Text>
              <Text style={styles.recentOrderStore}>Delivered from Apollo Medical Store</Text>
            </View>
            <TouchableOpacity
              style={styles.reorderBtn}
              onPress={onReorderPress}
              activeOpacity={0.75}
            >
              <Text style={styles.reorderBtnText}>Reorder</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. Nearby Medical Shops Section (matching reference UI doctor cards) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Nearby Medical Shops</Text>
          <TouchableOpacity onPress={onViewAllStores} activeOpacity={0.7}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.storesSection}>
          {loading && !refreshing ? (
            <Loader message="Locating verified pharmacies nearby..." />
          ) : stores.length > 0 ? (
            stores.slice(0, 3).map((store) => (
              <StoreCard
                key={store.id}
                store={store}
                onPress={() => onStorePress(store)}
              />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <StoreIcon width={40} height={40} color={color.textDisabled} />
              <Text style={styles.emptyTitle}>No medical shops found</Text>
              <Text style={styles.emptySubtitle}>
                Try changing your location or search for medicines directly.
              </Text>
            </View>
          )}
        </View>

        {/* 5. Popular Medicines Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Popular Medicines</Text>
          <TouchableOpacity onPress={onSearchPress} activeOpacity={0.7}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.medicinesScroll}
        >
          {POPULAR_MEDICINES.map((med: EssentialMedicine) => {
            const isAdding = addingMedId === med.id;
            return (
              <View key={med.id} style={styles.medicineCard}>
                <View style={styles.discountPill}>
                  <Text style={styles.discountPillText}>Save {med.discountPercent}%</Text>
                </View>

                <View style={styles.medicineIconBox}>
                  <PillCapsuleIcon width={24} height={24} color={color.primary} />
                </View>

                <Text style={styles.medicineName} numberOfLines={1}>
                  {med.name}
                </Text>
                <Text style={styles.medicineComposition} numberOfLines={1}>
                  {med.composition}
                </Text>
                <Text style={styles.medicinePackSize}>{med.packSize}</Text>

                <View style={styles.medicineFooter}>
                  <View style={styles.priceRow}>
                    <Text style={styles.medPrice}>₹{med.price}</Text>
                    <Text style={styles.medMrp}>₹{med.mrp}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => onQuickAdd(med)}
                    activeOpacity={0.8}
                    disabled={isAdding}
                  >
                    {isAdding ? (
                      <ActivityIndicator size="small" color={color.primary} />
                    ) : (
                      <Text style={styles.addBtnText}>+ ADD</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </ScrollView>

      {/* Location Bottom Sheet / Modal (matching Reference Screenshot) */}
      <Modal
        visible={locationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLocationModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Choose your location</Text>
              <TouchableOpacity onPress={() => setLocationModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pincodeInputRow}>
              <TextInput
                style={styles.pincodeInput}
                placeholder="Enter 6-digit PIN code"
                placeholderTextColor={color.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                value={pincodeText}
                onChangeText={setPincodeText}
              />
              <TouchableOpacity
                style={styles.pincodeApplyBtn}
                onPress={() => handleApplyPincode(pincodeText)}
                activeOpacity={0.8}
              >
                <Text style={styles.pincodeApplyText}>Check</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.useGpsBtn}
              onPress={() => handleSelectCity('Current Location (GPS)', 18.5204, 73.8567)}
              activeOpacity={0.7}
            >
              <LocationPinIcon width={16} height={16} color={color.primary} />
              <Text style={styles.useGpsText}>Use your current location</Text>
            </TouchableOpacity>

            <Text style={styles.cityChipsTitle}>Popular Cities</Text>
            <View style={styles.cityChipsRow}>
              {[
                { name: 'Pune', lat: 18.5204, lng: 73.8567 },
                { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
                { name: 'Delhi NCR', lat: 28.6139, lng: 77.209 },
                { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
              ].map((c) => {
                const isActive = city?.startsWith(c.name);
                return (
                  <TouchableOpacity
                    key={c.name}
                    style={[styles.cityChip, isActive && styles.cityChipActive]}
                    onPress={() => handleSelectCity(c.name, c.lat, c.lng)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.cityChipText,
                        isActive && styles.cityChipTextActive,
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default StoreDiscovery;

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StoreCardProps } from './storeCardProps';
import { styles } from './storeCard.style';
import { StoreIcon } from '../../../assets/svg/StoreIcon';
import { StarIcon } from '../../../assets/svg/StarIcon';
import color from '../../../theme/color';

export const StoreCard: React.FC<StoreCardProps> = ({ store, onPress }) => {
  const rating = store.rating != null ? store.rating.toFixed(1) : '4.8';
  const reviews = store.reviewCount || 428;
  const distanceFormatted =
    store.distanceKm != null ? `${store.distanceKm.toFixed(1)} km away` : '0.5 km away';
  const addressText = store.addressLine1 || store.city || 'Shop 1, Main Market Road';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Left Thumbnail (Storefront with Medical Cross Badge) */}
      <View style={styles.thumbnailBox}>
        <StoreIcon width={28} height={28} color={color.primary} />
        <View style={styles.crossPill}>
          <Text style={styles.crossText}>+</Text>
        </View>
      </View>

      {/* Middle Information */}
      <View style={styles.contentCol}>
        <Text style={styles.storeName} numberOfLines={1}>
          {store.storeName}
        </Text>
        <Text style={styles.addressText} numberOfLines={1}>
          {addressText}
        </Text>

        <View style={styles.ratingRow}>
          <StarIcon width={12} height={12} color="#F59E0B" />
          <Text style={styles.ratingScore}>{rating}</Text>
          <Text style={styles.reviewCount}>({reviews})</Text>
        </View>
      </View>

      {/* Right Column: Distance & Action Button (matching reference image) */}
      <View style={styles.actionCol}>
        <Text style={styles.distanceText}>{distanceFormatted}</Text>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onPress}
          activeOpacity={0.85}
        >
          <Text style={styles.actionBtnText}>View Store</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default StoreCard;

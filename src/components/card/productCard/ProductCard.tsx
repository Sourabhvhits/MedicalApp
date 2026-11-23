import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ProductCardProps } from './productCardProps';
import { styles } from './productCard.style';
import { formatCurrency } from '../../../utility/common';

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  onAddToCart,
}) => {
  const isRx = Boolean(product.prescriptionRequired);
  const hasDiscount = product.mrp && product.mrp > product.price;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.topRow}>
        <View style={styles.titleCol}>
          <Text style={styles.brandName} numberOfLines={1}>
            {product.brandName || product.name}
          </Text>
          {product.composition ? (
            <Text style={styles.composition} numberOfLines={1}>
              {product.composition}
            </Text>
          ) : null}
        </View>

        {isRx && (
          <View style={styles.rxBadge}>
            <Text style={styles.rxText}>Rx</Text>
          </View>
        )}
      </View>

      {product.storeName ? (
        <View style={styles.storePill}>
          <Text style={styles.storeText} numberOfLines={1}>
            At {product.storeName}
          </Text>
        </View>
      ) : null}

      <View style={styles.bottomRow}>
        <View style={styles.priceContainer}>
          <Text style={styles.sellingPrice}>{formatCurrency(product.price)}</Text>
          {hasDiscount && (
            <>
              <Text style={styles.mrp}>{formatCurrency(product.mrp)}</Text>
              {product.discountPercent ? (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{product.discountPercent}% OFF</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {onAddToCart ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={onAddToCart}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>+ ADD</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

export default ProductCard;

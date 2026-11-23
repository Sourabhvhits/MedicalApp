import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CartItemCardProps } from './cartItemCardProps';
import { styles } from './cartItemCard.style';
import { formatCurrency } from '../../../utility/common';
import { TrashIcon } from '../../../assets/svg/TrashIcon';

export const CartItemCard: React.FC<CartItemCardProps> = ({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  loading = false,
}) => {
  const isRx = Boolean(item.prescriptionRequired ?? item.product?.prescriptionRequired);
  const lineTotal = item.lineTotal ?? (item.unitPrice * item.quantity);
  const displayName =
    item.name ||
    item.brandName ||
    item.product?.brandName ||
    item.product?.name ||
    'Medicine Item';
  const displayComposition = item.packSize || item.product?.composition;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.titleCol}>
          <Text style={styles.brandName} numberOfLines={1}>
            {displayName}
          </Text>
          {displayComposition ? (
            <Text style={styles.composition} numberOfLines={1}>
              {displayComposition}
            </Text>
          ) : null}
        </View>

        {isRx && (
          <View style={styles.rxBadge}>
            <Text style={styles.rxText}>Rx Required</Text>
          </View>
        )}
      </View>

      {item.issue ? (
        <View style={styles.issueBanner}>
          <Text style={styles.issueText}>{item.issue}</Text>
        </View>
      ) : null}

      <View style={styles.bottomRow}>
        <Text style={styles.priceText}>{formatCurrency(lineTotal)}</Text>

        <View style={styles.actionRow}>
          {/* Quantity Stepper */}
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={onDecrement}
              disabled={loading || item.quantity <= 1}
              activeOpacity={0.7}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>

            <Text style={styles.quantityText}>{item.quantity}</Text>

            <TouchableOpacity
              style={styles.stepBtn}
              onPress={onIncrement}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Remove Trash Button */}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={onRemove}
            disabled={loading}
            activeOpacity={0.7}
          >
            <TrashIcon width={18} height={18} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default CartItemCard;

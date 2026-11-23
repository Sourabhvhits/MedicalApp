import { StyleSheet } from 'react-native';
import { color, font, spacing } from '@theme';
import { responsiveFont } from '@utility/responsive';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1.2,
    borderColor: color.border,
    padding: spacing.cardPadding,
    marginBottom: spacing.md,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  titleCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  brandName: {
    fontFamily: font.bold,
    fontSize: responsiveFont(14),
    color: color.textPrimary,
  },
  composition: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11),
    color: color.textSecondary,
    marginTop: 2,
  },
  rxBadge: {
    backgroundColor: color.errorLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusPill,
    borderWidth: 1,
    borderColor: color.error,
  },
  rxText: {
    fontFamily: font.bold,
    fontSize: responsiveFont(10),
    color: color.error,
  },
  storePill: {
    alignSelf: 'flex-start',
    backgroundColor: color.primaryMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusPill,
    marginBottom: spacing.sm,
  },
  storeText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(11),
    color: color.primary,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sellingPrice: {
    fontFamily: font.bold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
  },
  mrp: {
    fontFamily: font.regular,
    fontSize: responsiveFont(12),
    color: color.textMuted,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: color.secondaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusPill,
  },
  discountText: {
    fontFamily: font.bold,
    fontSize: responsiveFont(10),
    color: color.secondary,
  },
  addButton: {
    backgroundColor: color.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusPill,
    shadowColor: color.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    fontFamily: font.bold,
    fontSize: responsiveFont(12),
    color: color.white,
    letterSpacing: 0.5,
  },
});

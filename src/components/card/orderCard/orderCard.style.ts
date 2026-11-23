import { StyleSheet } from 'react-native';
import { color, font, spacing } from '@theme';
import { responsiveFont } from '@utility/responsive';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: color.border,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orderNumber: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusPill,
  },
  statusText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(11),
  },
  dateText: {
    fontFamily: font.regular,
    fontSize: responsiveFont(12),
    color: color.textMuted,
    marginBottom: spacing.sm,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  storeName: {
    fontFamily: font.medium,
    fontSize: responsiveFont(13),
    color: color.textSecondary,
    marginLeft: spacing.xs,
  },
  itemsPreview: {
    backgroundColor: color.background,
    borderRadius: spacing.borderRadiusSm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  itemsCountText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
    marginBottom: 2,
  },
  itemNamesText: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11),
    color: color.textMuted,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  fulfillmentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusSm,
    backgroundColor: color.primaryMuted,
  },
  fulfillmentText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(11),
    color: color.primary,
  },
  totalAmount: {
    fontFamily: font.bold,
    fontSize: responsiveFont(16),
    color: color.primary,
  },
});

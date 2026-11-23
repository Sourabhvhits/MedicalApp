import { StyleSheet } from 'react-native';
import color from '../../../theme/color';
import font from '../../../theme/font';
import spacing from '../../../theme/spacing';
import { responsiveFont } from '../../../utility/responsive';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background,
  },
  content: {
    padding: spacing.screenGutter,
    paddingBottom: spacing.xxl * 2,
  },
  storeBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: color.surface,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: color.border,
    marginBottom: spacing.md,
  },
  storeInfo: {
    flex: 1,
  },
  storeLabel: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11),
    color: color.textSecondary,
  },
  storeName: {
    fontFamily: font.bold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
    marginTop: 2,
  },
  clearCartText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(12),
    color: color.error,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: responsiveFont(16),
    color: color.textPrimary,
    marginBottom: spacing.sm,
  },
  billCard: {
    backgroundColor: color.surface,
    padding: spacing.cardPadding,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: color.border,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  billTitle: {
    fontFamily: font.bold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
    marginBottom: spacing.sm,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  billLabel: {
    fontFamily: font.regular,
    fontSize: responsiveFont(13),
    color: color.textSecondary,
  },
  billValue: {
    fontFamily: font.medium,
    fontSize: responsiveFont(13),
    color: color.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: color.divider,
    marginVertical: spacing.sm,
  },
  grandTotalLabel: {
    fontFamily: font.bold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
  },
  grandTotalValue: {
    fontFamily: font.bold,
    fontSize: responsiveFont(18),
    color: color.primary,
  },
  checkoutBtn: {
    marginTop: spacing.xs,
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    fontFamily: font.bold,
    fontSize: responsiveFont(18),
    color: color.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontFamily: font.regular,
    fontSize: responsiveFont(13),
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  browseBtn: {
    minWidth: 180,
  },
});

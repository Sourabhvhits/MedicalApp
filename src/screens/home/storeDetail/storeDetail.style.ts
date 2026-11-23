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
  storeHeroCard: {
    backgroundColor: color.surface,
    padding: spacing.cardPadding,
    marginHorizontal: spacing.screenGutter,
    marginVertical: spacing.sm,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: color.border,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  storeTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  storeName: {
    fontFamily: font.bold,
    fontSize: responsiveFont(18),
    color: color.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusPill,
  },
  statusOpen: {
    backgroundColor: color.successLight,
  },
  statusClosed: {
    backgroundColor: color.errorLight,
  },
  statusText: {
    fontFamily: font.bold,
    fontSize: responsiveFont(11),
  },
  statusOpenText: {
    color: color.success,
  },
  statusClosedText: {
    color: color.error,
  },
  storeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  metaText: {
    fontFamily: font.regular,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
    marginLeft: 4,
  },
  pickupHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.primaryMuted,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusSm,
    marginTop: spacing.sm,
  },
  pickupHighlightText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(12),
    color: color.primary,
    marginLeft: 6,
  },
  searchContainer: {
    paddingHorizontal: spacing.screenGutter,
    marginBottom: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenGutter,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: responsiveFont(16),
    color: color.textPrimary,
  },
  productCount: {
    fontFamily: font.regular,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
  },
  listContent: {
    paddingHorizontal: spacing.screenGutter,
    paddingBottom: spacing.xxl,
  },
  emptyBox: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(14),
    color: color.textMuted,
  },
});

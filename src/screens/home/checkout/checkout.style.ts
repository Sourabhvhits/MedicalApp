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
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: color.surface,
    padding: spacing.cardPadding,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: color.border,
    marginBottom: spacing.md,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontFamily: font.bold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
    marginBottom: spacing.sm,
  },
  rxRequiredNotice: {
    backgroundColor: color.errorLight,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusSm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: color.error,
  },
  rxRequiredText: {
    fontFamily: font.bold,
    fontSize: responsiveFont(12),
    color: color.error,
  },
  uploadBox: {
    borderWidth: 1.5,
    borderColor: color.primary,
    borderStyle: 'dashed',
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primaryMuted,
  },
  uploadTitle: {
    fontFamily: font.bold,
    fontSize: responsiveFont(14),
    color: color.primary,
    marginTop: spacing.xs,
  },
  uploadSubtitle: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11),
    color: color.textSecondary,
    marginTop: 2,
  },
  uploadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.successLight,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: color.success,
  },
  uploadedText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(12),
    color: color.success,
    marginLeft: spacing.xs,
    flex: 1,
  },
  slotPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  slotPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.background,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  slotPillActive: {
    borderColor: color.primary,
    backgroundColor: color.primaryMuted,
  },
  slotText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
  },
  slotTextActive: {
    color: color.primary,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1.5,
    borderColor: color.border,
    marginBottom: spacing.xs,
  },
  paymentOptionActive: {
    borderColor: color.primary,
    backgroundColor: color.primaryMuted,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: color.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  radioCircleActive: {
    borderColor: color.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: color.primary,
  },
  paymentLabel: {
    fontFamily: font.bold,
    fontSize: responsiveFont(14),
    color: color.textPrimary,
  },
  paymentDesc: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11),
    color: color.textSecondary,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  summaryLabel: {
    fontFamily: font.regular,
    fontSize: responsiveFont(13),
    color: color.textSecondary,
  },
  summaryValue: {
    fontFamily: font.medium,
    fontSize: responsiveFont(13),
    color: color.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: color.divider,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    fontFamily: font.bold,
    fontSize: responsiveFont(16),
    color: color.textPrimary,
  },
  totalValue: {
    fontFamily: font.bold,
    fontSize: responsiveFont(18),
    color: color.primary,
  },
  placeOrderBtn: {
    marginTop: spacing.md,
  },
});

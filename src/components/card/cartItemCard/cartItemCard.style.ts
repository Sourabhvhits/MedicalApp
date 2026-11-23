import { StyleSheet } from 'react-native';
import color from '../../../theme/color';
import font from '../../../theme/font';
import spacing from '../../../theme/spacing';
import { responsiveFont } from '../../../utility/responsive';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.cardPadding,
    marginBottom: spacing.sm,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  titleCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  brandName: {
    fontFamily: font.bold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
  },
  composition: {
    fontFamily: font.regular,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
    marginTop: 2,
  },
  rxBadge: {
    backgroundColor: color.warningLight,
    borderWidth: 1,
    borderColor: color.warning,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  rxText: {
    fontFamily: font.bold,
    fontSize: responsiveFont(10),
    color: color.warning,
  },
  issueBanner: {
    backgroundColor: color.errorLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusSm,
    marginTop: 4,
  },
  issueText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(11),
    color: color.error,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  priceText: {
    fontFamily: font.bold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: spacing.borderRadiusSm,
    height: 32,
    marginRight: spacing.md,
  },
  stepBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    fontFamily: font.bold,
    fontSize: responsiveFont(16),
    color: color.primary,
  },
  quantityText: {
    fontFamily: font.bold,
    fontSize: responsiveFont(13),
    color: color.textPrimary,
    paddingHorizontal: 8,
  },
  deleteBtn: {
    padding: 6,
  },
});

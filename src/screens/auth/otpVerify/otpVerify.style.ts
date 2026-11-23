import { StyleSheet } from 'react-native';
import { responsiveFont } from '@utility/responsive';
import { color, font, spacing } from '@theme';

export const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  bold: {
  },
  container: {
    flex: 1,
    backgroundColor: color.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenGutter,
    paddingTop: spacing.xl,
  },
  infoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: color.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: font.bold,
    fontSize: responsiveFont(22),
    color: color.textPrimary,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: responsiveFont(14),
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    lineHeight: 20,
  },
  identifierHighlight: {
    fontFamily: font.medium,
    color: color.textPrimary,
  },
  devCodeBanner: {
    backgroundColor: color.warningLight,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusSm,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: color.warning,
  },
  devCodeText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(12),
    color: color.textPrimary,
  },
  formCard: {
    backgroundColor: color.surface,
    padding: spacing.cardPadding,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: color.border,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  verifyButton: {
    marginTop: spacing.sm,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  resendText: {
    fontFamily: font.regular,
    fontSize: responsiveFont(14),
    color: color.textSecondary,
  },
  resendLink: {
    fontFamily: font.bold,
    fontSize: responsiveFont(14),
    color: color.primary,
    marginLeft: 4,
  },
  timerText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(14),
    color: color.textDisabled,
    marginLeft: 4,
  },
});

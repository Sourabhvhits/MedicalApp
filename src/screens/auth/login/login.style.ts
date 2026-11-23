import { StyleSheet } from 'react-native';
import { responsiveFont } from '@utility/responsive';
import { color, font, spacing } from '@theme';

export const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: color.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenGutter,
    paddingBottom: spacing.xxl * 2,
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  brandIconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: color.primaryMuted,
    borderWidth: 1.5,
    borderColor: color.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  appName: {
    fontFamily: font.bold,
    fontSize: responsiveFont(22),
    color: color.primaryDark,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: font.bold,
    fontSize: responsiveFont(26),
    color: color.textPrimary,
    marginTop: spacing.md,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: responsiveFont(14),
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  formSection: {
    backgroundColor: color.surface,
    padding: spacing.cardPadding,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: color.border,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  forgotText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(13),
    color: color.primary,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontFamily: font.regular,
    fontSize: responsiveFont(14),
    color: color.textSecondary,
  },
  signUpLink: {
    fontFamily: font.bold,
    fontSize: responsiveFont(14),
    color: color.primary,
    marginLeft: 4,
  },
  demoSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  demoLabel: {
    fontFamily: font.medium,
    fontSize: responsiveFont(12),
    color: color.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  demoPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadiusSm,
    backgroundColor: color.divider,
    margin: 2,
  },
  demoPillText: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11),
    color: color.textSecondary,
  },
});

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
  submitButton: {
    marginTop: spacing.md,
  },
});

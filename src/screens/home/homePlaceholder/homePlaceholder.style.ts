import { StyleSheet } from 'react-native';
import { responsiveFont } from '@utility/responsive';
import { color, font, spacing } from '@theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background,
  },
  content: {
    padding: spacing.screenGutter,
  },
  welcomeCard: {
    backgroundColor: color.surface,
    padding: spacing.lg,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: color.border,
    marginBottom: spacing.lg,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: color.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  greetingText: {
    flex: 1,
  },
  welcomeTitle: {
    fontFamily: font.bold,
    fontSize: responsiveFont(20),
    color: color.textPrimary,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: color.primaryMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusPill,
    marginTop: 4,
  },
  roleText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(11),
    color: color.primary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  infoLabel: {
    fontFamily: font.medium,
    fontSize: responsiveFont(13),
    color: color.textSecondary,
    width: 80,
  },
  infoValue: {
    fontFamily: font.regular,
    fontSize: responsiveFont(13),
    color: color.textPrimary,
    flex: 1,
  },
  phaseCard: {
    backgroundColor: color.primaryMuted,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: color.primaryLight,
    marginBottom: spacing.xl,
  },
  phaseTitle: {
    fontFamily: font.bold,
    fontSize: responsiveFont(15),
    color: color.primaryDark,
    marginBottom: 4,
  },
  phaseDescription: {
    fontFamily: font.regular,
    fontSize: responsiveFont(13),
    color: color.primaryDark,
    lineHeight: 18,
  },
  browseStoreButton: {
    marginBottom: spacing.md,
  },
  logoutButton: {
    borderColor: color.error,
  },
});

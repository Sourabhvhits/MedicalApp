import { StyleSheet } from 'react-native';
import { color, font, spacing } from '@theme';
import { responsiveFont } from '@utility/responsive';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background,
  },
  scrollContent: {
    padding: spacing.screenGutter,
    paddingBottom: spacing.xxl * 2,
  },
  pageSubtitle: {
    fontFamily: font.regular,
    fontSize: responsiveFont(13),
    color: color.textSecondary,
    marginBottom: spacing.md,
  },
  categoryCard: {
    backgroundColor: color.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: spacing.md,
  },
  infoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  categoryTitle: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
    flex: 1,
  },
  countPill: {
    backgroundColor: color.primaryMuted,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: color.primaryLight,
  },
  countText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(10.5),
    color: color.primaryDark,
  },
  categoryDesc: {
    fontFamily: font.regular,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  arrowChevron: {
    marginLeft: spacing.xs,
    fontSize: responsiveFont(16),
    color: color.textMuted,
  },
});

import { StyleSheet } from 'react-native';
import { color, font, spacing } from '@theme';
import { responsiveFont } from '@utility/responsive';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background,
  },
  filterScroll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: color.surface,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadiusPill,
    backgroundColor: color.background,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: color.border,
  },
  filterChipActive: {
    backgroundColor: color.primaryLight,
    borderColor: color.primary,
  },
  filterChipText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
  },
  filterChipTextActive: {
    fontFamily: font.semiBold,
    color: color.primary,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl * 2,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    marginTop: spacing.xxl,
  },
  emptyTitle: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(17),
    color: color.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontFamily: font.regular,
    fontSize: responsiveFont(13),
    color: color.textMuted,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});

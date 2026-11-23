import { StyleSheet } from 'react-native';
import { color, font, spacing } from '@theme';
import { responsiveFont } from '@utility/responsive';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background,
  },
  headerSearchWrapper: {
    backgroundColor: color.surface,
    paddingHorizontal: spacing.screenGutter,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: spacing.md,
    height: 44,
    marginTop: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: responsiveFont(13),
    color: color.textPrimary,
    marginLeft: spacing.sm,
    paddingVertical: 0,
  },
  filterScrollWrapper: {
    backgroundColor: color.surface,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
    height: 48,
    flexGrow: 0,
    justifyContent: 'center',
  },
  filterScroll: {
    paddingHorizontal: spacing.screenGutter,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  filterChipInactive: {
    backgroundColor: color.surface,
    borderColor: color.border,
  },
  filterChipText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(12),
  },
  filterChipTextActive: {
    color: color.white,
    fontFamily: font.semiBold,
  },
  filterChipTextInactive: {
    color: color.textSecondary,
  },
  listContent: {
    padding: spacing.screenGutter,
    paddingBottom: spacing.xxl * 2,
  },
  resultsCount: {
    fontFamily: font.medium,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
    marginBottom: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    marginTop: spacing.xl,
    backgroundColor: color.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.border,
  },
  emptyTitle: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontFamily: font.regular,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});

import { StyleSheet } from 'react-native';
import { color, font, spacing } from '@theme';
import { responsiveFont } from '@utility/responsive';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: color.border,
  },
  cardTitle: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
    marginBottom: spacing.sm,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  storeName: {
    fontFamily: font.bold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
    marginLeft: spacing.xs,
  },
  storeDetailText: {
    fontFamily: font.regular,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    fontFamily: font.regular,
    fontSize: responsiveFont(13),
    color: color.textSecondary,
  },
  infoValue: {
    fontFamily: font.medium,
    fontSize: responsiveFont(13),
    color: color.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: color.divider,
    marginVertical: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemName: {
    fontFamily: font.medium,
    fontSize: responsiveFont(13),
    color: color.textPrimary,
  },
  itemSubtext: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11),
    color: color.textMuted,
    marginTop: 2,
  },
  itemPrice: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(13),
    color: color.textPrimary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  grandTotalLabel: {
    fontFamily: font.bold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
  },
  grandTotalValue: {
    fontFamily: font.bold,
    fontSize: responsiveFont(17),
    color: color.primary,
  },
  actionContainer: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  cancelButton: {
    borderColor: color.error,
  },
  cancelButtonText: {
    color: color.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: color.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: color.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.lg,
  },
  modalTitle: {
    fontFamily: font.bold,
    fontSize: responsiveFont(17),
    color: color.textPrimary,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontFamily: font.regular,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalBtn: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusPill,
  },
  headerBadge: {
    marginRight: spacing.sm,
  },
  statusBadgeText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(11),
  },
});

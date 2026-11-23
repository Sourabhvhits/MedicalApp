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
    paddingBottom: spacing.xxl,
  },
  titleSection: {
    marginVertical: spacing.md,
  },
  title: {
    fontFamily: font.bold,
    fontSize: responsiveFont(24),
    color: color.textPrimary,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: responsiveFont(14),
    color: color.textSecondary,
    marginTop: 4,
  },
  roleSelectorContainer: {
    marginBottom: spacing.md,
  },
  roleSelectorLabel: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(13),
    color: color.textPrimary,
    marginBottom: spacing.xs,
  },
  roleCardsCol: {
    gap: 8,
  },
  roleCard: {
    backgroundColor: color.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  roleCardActive: {
    backgroundColor: '#F0FDFA',
    borderColor: color.primary,
  },
  roleIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleIconBoxActive: {
    backgroundColor: color.primary,
  },
  roleTextBox: {
    flex: 1,
  },
  roleCardTitle: {
    fontFamily: font.bold,
    fontSize: responsiveFont(14),
    color: color.textPrimary,
  },
  roleCardTitleActive: {
    color: color.primary,
  },
  roleCardDesc: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11.5),
    color: color.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  businessNoticeBox: {
    backgroundColor: '#FEF9C3', // Light yellow alert matching web
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE047',
    padding: 12,
    marginVertical: spacing.sm,
  },
  businessNoticeText: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11.5),
    color: '#854D0E',
    lineHeight: 16,
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
    shadowRadius: 8,
    elevation: 2,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  submitButton: {
    marginTop: spacing.md,
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    fontFamily: font.regular,
    fontSize: responsiveFont(14),
    color: color.textSecondary,
  },
  signInLink: {
    fontFamily: font.bold,
    fontSize: responsiveFont(14),
    color: color.primary,
    marginLeft: 4,
  },
});

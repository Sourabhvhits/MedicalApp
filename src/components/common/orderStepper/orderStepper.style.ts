import { StyleSheet } from 'react-native';
import { color, font, spacing } from '@theme';
import { responsiveFont } from '@utility/responsive';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: color.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: color.border,
  },
  title: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
    marginBottom: spacing.md,
  },
  terminalAlert: {
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    backgroundColor: color.errorLight,
    borderWidth: 1,
    borderColor: color.error,
    marginBottom: spacing.sm,
  },
  terminalTitle: {
    fontFamily: font.bold,
    fontSize: responsiveFont(13),
    color: color.error,
    marginBottom: 2,
  },
  terminalNote: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11),
    color: color.textSecondary,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  indicatorCol: {
    alignItems: 'center',
    width: 28,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: color.border,
    backgroundColor: color.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleActive: {
    borderColor: color.primary,
    backgroundColor: color.primary,
  },
  circleDone: {
    borderColor: color.primary,
    backgroundColor: color.primary,
  },
  circleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.surface,
  },
  verticalLine: {
    width: 2,
    height: 28,
    backgroundColor: color.border,
  },
  verticalLineDone: {
    backgroundColor: color.primary,
  },
  contentCol: {
    flex: 1,
    marginLeft: spacing.sm,
    paddingBottom: spacing.sm,
  },
  stepLabel: {
    fontFamily: font.medium,
    fontSize: responsiveFont(13),
    color: color.textMuted,
  },
  stepLabelActive: {
    fontFamily: font.bold,
    color: color.textPrimary,
  },
  stepTime: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11),
    color: color.textMuted,
    marginTop: 2,
  },
  stepNote: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11),
    color: color.textSecondary,
    marginTop: 2,
  },
});

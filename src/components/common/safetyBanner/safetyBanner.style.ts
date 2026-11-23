import { StyleSheet } from 'react-native';
import color from '../../../theme/color';
import font from '../../../theme/font';
import spacing from '../../../theme/spacing';
import { responsiveFont } from '../../../utility/responsive';

export const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  severeContainer: {
    backgroundColor: color.errorLight,
    borderColor: color.error,
  },
  moderateContainer: {
    backgroundColor: color.warningLight,
    borderColor: color.warning,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontFamily: font.bold,
    fontSize: responsiveFont(14),
    marginLeft: spacing.xs,
  },
  severeTitle: {
    color: color.error,
  },
  moderateTitle: {
    color: color.warning,
  },
  warningItem: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  warningPair: {
    fontFamily: font.bold,
    fontSize: responsiveFont(12),
    color: color.textPrimary,
  },
  warningDesc: {
    fontFamily: font.regular,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  mandatoryNote: {
    fontFamily: font.bold,
    fontSize: responsiveFont(11),
    color: color.error,
    marginTop: 6,
  },
});

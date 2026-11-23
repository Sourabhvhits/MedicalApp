import { StyleSheet } from 'react-native';
import { responsiveFont } from '@utility/responsive';
import { color, font, spacing } from '@theme';

export const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontFamily: font.medium,
    fontSize: responsiveFont(13),
    color: color.textPrimary,
  },
  requiredStar: {
    color: color.error,
    marginLeft: 2,
    fontSize: responsiveFont(13),
  },
  inputWrapper: {
    height: spacing.inputHeight,
    backgroundColor: color.inputBackground,
    borderWidth: 1.2,
    borderColor: color.inputBorder,
    borderRadius: spacing.borderRadiusMd,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  focused: {
    borderColor: color.inputBorderFocused,
  },
  hasError: {
    borderColor: color.error,
    backgroundColor: '#FFFDFD',
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: font.regular,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
    paddingVertical: 0,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  rightIcon: {
    marginLeft: spacing.sm,
    padding: 4,
  },
  errorText: {
    fontFamily: font.regular,
    fontSize: responsiveFont(12),
    color: color.error,
    marginTop: 4,
    marginLeft: 2,
  },
});

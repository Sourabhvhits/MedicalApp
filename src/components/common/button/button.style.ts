import { StyleSheet } from 'react-native';
import { responsiveFont } from '@utility/responsive';
import { color, font, spacing } from '@theme';

export const styles = StyleSheet.create({
  base: {
    height: spacing.buttonHeight,
    borderRadius: spacing.borderRadiusPill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: color.primary,
    shadowColor: color.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  secondary: {
    backgroundColor: color.secondary,
    shadowColor: color.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  outline: {
    backgroundColor: color.transparent,
    borderWidth: 1.5,
    borderColor: color.primary,
  },
  text: {
    backgroundColor: color.transparent,
    height: 'auto',
    paddingVertical: spacing.sm,
  },
  disabled: {
    backgroundColor: color.inputBorder,
    borderColor: color.inputBorder,
  },
  textBase: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(14),
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  primaryText: {
    color: color.white,
  },
  secondaryText: {
    color: color.white,
  },
  outlineText: {
    color: color.primary,
  },
  textVariantText: {
    color: color.primary,
  },
  disabledText: {
    color: color.textDisabled,
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
});

import { responsiveWidth, responsiveHeight } from '@utility/responsive';

const spacing = {
  xs: responsiveWidth(4),
  sm: responsiveWidth(8),
  md: responsiveWidth(16),
  lg: responsiveWidth(24),
  xl: responsiveWidth(32),
  xxl: responsiveWidth(40),

  screenGutter: responsiveWidth(20),
  cardPadding: responsiveWidth(16),
  inputHeight: responsiveHeight(52),
  buttonHeight: responsiveHeight(52),

  borderRadiusSm: 8,
  borderRadiusMd: 12,
  borderRadiusLg: 18,
  borderRadiusXl: 24,
  borderRadiusPill: 9999,
};

export default spacing;

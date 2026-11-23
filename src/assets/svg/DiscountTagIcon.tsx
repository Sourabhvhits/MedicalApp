import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const DiscountTagIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#0D9488',
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20.59 13.41L13.42 20.58C13.0454 20.9547 12.5372 21.1654 12.0075 21.1654C11.4778 21.1654 10.9696 20.9547 10.595 20.58L2.41 12.41C2.14917 12.1497 2.00169 11.7963 2 11.428V4C2 2.89543 2.89543 2 4 2H11.428C11.7963 2.00169 12.1497 2.14917 12.41 2.41L20.59 10.59C20.9647 10.9646 21.1754 11.4728 21.1754 12.0025C21.1754 12.5322 20.9647 13.0404 20.59 13.41Z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M7 7H7.01" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
  </Svg>
);

export default DiscountTagIcon;

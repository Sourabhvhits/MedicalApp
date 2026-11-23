import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface IconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const AwardRibbonIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#0D9488',
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="6" stroke={color} strokeWidth={1.8} />
    <Path
      d="M8.5 13.5L7 21L12 18L17 21L15.5 13.5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M10 8L11.5 9.5L14.5 6.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default AwardRibbonIcon;

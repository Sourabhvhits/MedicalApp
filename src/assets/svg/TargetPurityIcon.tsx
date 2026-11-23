import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface IconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const TargetPurityIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#0D9488',
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.8} />
    <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth={1.8} />
    <Circle cx="12" cy="12" r="1.5" fill={color} />
    <Path d="M12 2V4M12 20V22M2 12H4M20 12H22" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

export default TargetPurityIcon;

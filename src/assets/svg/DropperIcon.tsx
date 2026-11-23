import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const DropperIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#7C3AED',
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M10.5 6.5L17.5 13.5M14 3L18 7L16 9L20 13L17 16L13 12L11 14L4 21H3V20L10 13L8 11L11 8L15 12L17 10L14 7L15 6L14 3Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default DropperIcon;

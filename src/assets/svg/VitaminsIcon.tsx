import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface IconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const VitaminsIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#D97706',
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Rect
      x="6"
      y="7"
      width="12"
      height="14"
      rx="3"
      stroke={color}
      strokeWidth={2}
    />
    <Path
      d="M9 3H15V7H9V3Z"
      stroke={color}
      strokeWidth={2}
      strokeLinejoin="round"
    />
    <Path
      d="M12 11V17M9 14H15"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

export default VitaminsIcon;

import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface Props {
  width?: number;
  height?: number;
  color?: string;
}

export const LockIcon: React.FC<Props> = ({ width = 20, height = 20, color = '#64748B' }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Rect
      x={3}
      y={11}
      width={18}
      height={11}
      rx={2}
      ry={2}
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M7 11V7a5 5 0 0110 0v4"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

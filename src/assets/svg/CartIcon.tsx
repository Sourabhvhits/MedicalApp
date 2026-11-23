import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface Props {
  width?: number;
  height?: number;
  color?: string;
}

export const CartIcon: React.FC<Props> = ({ width = 20, height = 20, color = '#64748B' }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Circle cx={9} cy={21} r={1} stroke={color} strokeWidth={2} />
    <Circle cx={20} cy={21} r={1} stroke={color} strokeWidth={2} />
    <Path
      d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

interface Props {
  width?: number;
  height?: number;
  color?: string;
}

export const TruckIcon: React.FC<Props> = ({ width = 20, height = 20, color = '#0D766E' }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Rect x={1} y={3} width={15} height={13} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M16 8h4l3 3v5h-7V8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={5.5} cy={18.5} r={2.5} stroke={color} strokeWidth={2} />
    <Circle cx={18.5} cy={18.5} r={2.5} stroke={color} strokeWidth={2} />
  </Svg>
);

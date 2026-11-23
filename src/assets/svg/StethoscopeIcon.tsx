import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  width?: number;
  height?: number;
  color?: string;
}

export const StethoscopeIcon: React.FC<Props> = ({ width = 24, height = 24, color = '#0D766E' }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4.5 3v5a4.5 4.5 0 009 0V3M8 15v1a6 6 0 006 6h1a3 3 0 003-3v-2M18 17a2 2 0 100-4 2 2 0 000 4z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

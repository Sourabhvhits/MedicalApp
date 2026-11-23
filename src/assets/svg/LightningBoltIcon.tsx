import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const LightningBoltIcon: React.FC<IconProps> = ({
  width = 14,
  height = 14,
  color = '#0D9488',
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill={color}>
    <Path
      d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
    />
  </Svg>
);

export default LightningBoltIcon;

import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const PillCapsuleIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#EF4444',
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M10.5 4.5L4.5 10.5C2.5 12.5 2.5 15.5 4.5 17.5C6.5 19.5 9.5 19.5 11.5 17.5L17.5 11.5C19.5 9.5 19.5 6.5 17.5 4.5C15.5 2.5 12.5 2.5 10.5 4.5Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M7.5 7.5L14.5 14.5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

export default PillCapsuleIcon;

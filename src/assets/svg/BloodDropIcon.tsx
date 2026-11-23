import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const BloodDropIcon: React.FC<IconProps> = ({
  width = 24,
  height = 24,
  color = '#0284C7',
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2.69L17.5 9.5C19.5 12 20 14.5 19 17C17.7 20 14.5 21.5 12 21.5C9.5 21.5 6.3 20 5 17C4 14.5 4.5 12 6.5 9.5L12 2.69Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M12 12V17M9.5 14.5H14.5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

export default BloodDropIcon;

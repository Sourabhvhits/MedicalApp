import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  width?: number;
  height?: number;
  color?: string;
  focused?: boolean;
}

export const StoreIcon: React.FC<Props> = ({
  width = 20,
  height = 20,
  color = '#0D9488',
  focused = false,
}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? color : 'none'}
    />
  </Svg>
);

export default StoreIcon;

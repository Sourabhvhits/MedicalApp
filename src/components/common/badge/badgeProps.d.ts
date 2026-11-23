import { StyleProp, ViewStyle } from 'react-native';

export interface BadgeProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  style?: StyleProp<ViewStyle>;
}

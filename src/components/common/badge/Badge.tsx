import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { BadgeProps } from './badgeProps';
import { styles } from './badge.style';

export const Badge: React.FC<BadgeProps> = ({
  label,
  active = false,
  onPress,
  icon,
  style,
}) => {
  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={[styles.pill, active && styles.pillActive, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </Component>
  );
};

export default Badge;

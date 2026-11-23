import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
} from 'react-native';
import { ButtonProps } from './buttonProps';
import { styles } from './button.style';
import { color } from '@theme';

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
}) => {
  const getContainerStyle = () => {
    if (disabled && variant !== 'text') return [styles.base, styles.disabled, style];
    switch (variant) {
      case 'secondary':
        return [styles.base, styles.secondary, style];
      case 'outline':
        return [styles.base, styles.outline, style];
      case 'text':
        return [styles.base, styles.text, style];
      case 'primary':
      default:
        return [styles.base, styles.primary, style];
    }
  };

  const getTextStyle = () => {
    if (disabled) return [styles.textBase, styles.disabledText, textStyle];
    switch (variant) {
      case 'secondary':
        return [styles.textBase, styles.secondaryText, textStyle];
      case 'outline':
        return [styles.textBase, styles.outlineText, textStyle];
      case 'text':
        return [styles.textBase, styles.textVariantText, textStyle];
      case 'primary':
      default:
        return [styles.textBase, styles.primaryText, textStyle];
    }
  };

  const spinnerColor = variant === 'outline' || variant === 'text' ? color.primary : color.white;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={getContainerStyle()}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <Text style={getTextStyle()}>{title}</Text>
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
};

export default Button;

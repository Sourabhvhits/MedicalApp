import { Text, TextInput } from 'react-native';

/**
 * Disables system dynamic font scaling so designs remain consistent
 * across accessibility font scaling settings.
 */
export const disableFontScaling = () => {
  const TextComponent = Text as any;
  const TextInputComponent = TextInput as any;

  if (TextComponent.defaultProps == null) {
    TextComponent.defaultProps = {};
  }
  TextComponent.defaultProps.allowFontScaling = false;

  if (TextInputComponent.defaultProps == null) {
    TextInputComponent.defaultProps = {};
  }
  TextInputComponent.defaultProps.allowFontScaling = false;
};

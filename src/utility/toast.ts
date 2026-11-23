import { Snackbar } from 'react-native-snackbar';
import { color } from '@theme';

export const Toast = (
  text: string,
  backgroundColor: string = color.primary,
  duration: number = Snackbar.LENGTH_SHORT,
) => {
  if (!text) return;
  Snackbar.show({
    text: String(text),
    duration,
    backgroundColor,
    textColor: color.white,
    action: {
      text: 'OK',
      textColor: color.white,
      onPress: () => Snackbar.dismiss(),
    },
  });
};

export const ToastError = (text: string) => Toast(text, color.error, Snackbar.LENGTH_LONG);
export const ToastSuccess = (text: string) => Toast(text, color.success, Snackbar.LENGTH_SHORT);
export const ToastWarning = (text: string) => Toast(text, color.warning, Snackbar.LENGTH_SHORT);

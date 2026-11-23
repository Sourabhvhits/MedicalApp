import { StyleSheet } from 'react-native';
import { responsiveFont } from '@utility/responsive';
import { color, font, spacing } from '@theme';

export const styles = StyleSheet.create({
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  inline: {
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: color.surface,
    padding: spacing.lg,
    borderRadius: spacing.borderRadiusMd,
    alignItems: 'center',
    minWidth: 140,
    elevation: 4,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  text: {
    fontFamily: font.medium,
    fontSize: responsiveFont(13),
    color: color.textPrimary,
    marginTop: spacing.sm,
  },
});

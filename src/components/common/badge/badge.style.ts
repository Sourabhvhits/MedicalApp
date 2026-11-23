import { StyleSheet } from 'react-native';
import { responsiveFont } from '@utility/responsive';
import { color, font, spacing } from '@theme';

export const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.borderRadiusPill,
    borderWidth: 1.5,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  pillActive: {
    borderColor: color.primary,
    backgroundColor: color.primaryMuted,
  },
  icon: {
    marginRight: spacing.xs,
  },
  text: {
    fontFamily: font.medium,
    fontSize: responsiveFont(13),
    color: color.textSecondary,
  },
  textActive: {
    color: color.primary,
  },
});

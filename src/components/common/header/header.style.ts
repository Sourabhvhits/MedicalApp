import { StyleSheet } from 'react-native';
import { responsiveFont } from '@utility/responsive';
import { color, font, spacing } from '@theme';

export const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenGutter,
    backgroundColor: color.background,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontFamily: font.bold,
    fontSize: responsiveFont(18),
    color: color.textPrimary,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
    marginTop: 2,
  },
  rightContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});

import { StyleSheet } from 'react-native';
import color from './color';
import spacing from './spacing';

export const defaultStyles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: color.background,
  },
  contentContainer: {
    paddingHorizontal: spacing.screenGutter,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardShadow: {
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});

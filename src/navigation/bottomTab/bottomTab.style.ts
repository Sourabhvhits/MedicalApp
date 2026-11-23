import { StyleSheet } from 'react-native';
import color from '../../theme/color';
import font from '../../theme/font';
import { responsiveFont } from '../../utility/responsive';

export const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.divider,
    paddingTop: 6,
    elevation: 12,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  tabItem: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  tabLabel: {
    fontFamily: font.medium,
    fontSize: responsiveFont(10.5),
    marginTop: 2,
    marginBottom: 2,
  },
});

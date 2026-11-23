import { StyleSheet } from 'react-native';
import { color, font, spacing } from '@theme';
import { responsiveFont } from '@utility/responsive';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface, // pure white #FFFFFF
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.border, // subtle 1px border #E2E8F0
    padding: 12,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
  },
  thumbnailBox: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: color.primaryMuted, // #F0FDFA
    borderWidth: 1,
    borderColor: color.primaryLight, // #CCFBF1
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  crossPill: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: color.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossText: {
    color: color.white,
    fontSize: 9,
    fontFamily: font.bold,
    lineHeight: 11,
  },
  contentCol: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.xs,
    justifyContent: 'center',
  },
  storeName: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(14.5),
    color: color.textPrimary, // Slate Dark #0F172A
  },
  addressText: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11.5),
    color: color.textSecondary, // Slate Gray #64748B
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingScore: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(11.5),
    color: color.textPrimary,
    marginLeft: 3,
  },
  reviewCount: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11),
    color: color.textMuted,
    marginLeft: 2,
  },
  actionCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 56,
  },
  distanceText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(11),
    color: color.textSecondary,
  },
  actionBtn: {
    backgroundColor: color.primary, // Deep Medical Teal #0D9488
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 10,
    minWidth: 84,
    alignItems: 'center',
    shadowColor: color.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  actionBtnText: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(11.5),
    color: color.white,
  },
});

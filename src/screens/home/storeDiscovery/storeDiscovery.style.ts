import { StyleSheet } from 'react-native';
import { color, font, spacing } from '@theme';
import { responsiveFont } from '@utility/responsive';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background, // soft off-white #F8FAFC
  },
  scrollContent: {
    paddingBottom: spacing.xxl * 2,
  },

  // 1. Top Header Section (matching reference UI)
  topHeader: {
    backgroundColor: color.surface, // pure white
    paddingHorizontal: spacing.screenGutter, // strict 16px
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingCol: {
    flex: 1,
  },
  helloGreeting: {
    fontFamily: font.regular,
    fontSize: responsiveFont(13),
    color: color.textSecondary, // Slate Gray #64748B
  },
  patientName: {
    fontFamily: font.bold,
    fontSize: responsiveFont(23),
    color: color.textPrimary, // Slate Dark #0F172A
    marginTop: 1,
    letterSpacing: -0.3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  locationText: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11.5),
    color: color.textSecondary,
    marginLeft: 3,
  },
  locationCityBold: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(12),
    color: color.textPrimary,
  },

  // Right White Pill Capsule Container (Cart + Profile Avatar)
  pillCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: 999, // capsule
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cartCapsuleBtn: {
    padding: 6,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  redDotBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.error,
  },
  pillDivider: {
    width: 1,
    height: 20,
    backgroundColor: color.divider,
    marginHorizontal: 4,
  },
  avatarBtn: {
    padding: 2,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: color.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 2. Search Container & Input (matching reference UI)
  searchContainer: {
    backgroundColor: color.surface,
    paddingHorizontal: spacing.screenGutter,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  searchBarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: 12,
    height: 48,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  searchPlaceholder: {
    fontFamily: font.regular,
    fontSize: responsiveFont(13.5),
    color: color.textMuted,
    marginLeft: 8,
    flex: 1,
  },

  // 2.5 Premium Promotional Hero Card (Card Type matching Blinkit/Apollo)
  heroBannerContainer: {
    paddingHorizontal: spacing.screenGutter,
    marginTop: spacing.md,
  },
  heroPromoCard: {
    backgroundColor: '#042F2E', // Deep Medical Spruce / Teal card
    borderRadius: 18,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  promoContentCol: {
    flex: 1,
    paddingRight: 10,
  },
  promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(204, 251, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
    gap: 4,
  },
  promoBadgeText: {
    fontFamily: font.bold,
    fontSize: responsiveFont(9.5),
    color: '#5EEAD4', // Mint highlight
    letterSpacing: 0.5,
  },
  promoTitle: {
    fontFamily: font.bold,
    fontSize: responsiveFont(17),
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 4,
    lineHeight: 22,
  },
  promoSubtitle: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11.5),
    color: '#99F6E4',
    lineHeight: 16,
    marginBottom: 10,
  },
  promoCtaBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  promoCtaText: {
    fontFamily: font.bold,
    fontSize: responsiveFont(11.5),
    color: '#FFFFFF',
  },
  promoGraphicCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  discountCircleBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: '#2DD4BF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountCirclePercent: {
    fontFamily: font.bold,
    fontSize: responsiveFont(20),
    color: '#2DD4BF',
    lineHeight: 22,
  },
  discountCircleOff: {
    fontFamily: font.bold,
    fontSize: responsiveFont(10),
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  discountCircleSub: {
    fontFamily: font.medium,
    fontSize: responsiveFont(10),
    color: '#CCFBF1',
    marginTop: 4,
  },

  // Recent Order Quick Card
  recentOrderSection: {
    paddingHorizontal: spacing.screenGutter,
    marginTop: spacing.md,
  },
  recentOrderCard: {
    backgroundColor: color.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: color.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  recentOrderLeft: {
    flex: 1,
  },
  recentOrderTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  recentOrderTag: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(10),
    color: color.primary,
    textTransform: 'uppercase',
  },
  recentOrderTitle: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(13),
    color: color.textPrimary,
  },
  recentOrderStore: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11),
    color: color.textSecondary,
    marginTop: 1,
  },
  reorderBtn: {
    backgroundColor: color.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: color.primaryMuted,
  },
  reorderBtnText: {
    fontFamily: font.bold,
    fontSize: responsiveFont(11.5),
    color: color.primary,
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenGutter,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: responsiveFont(19),
    color: color.textPrimary,
    letterSpacing: -0.2,
  },
  seeAllText: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(13.5),
    color: color.primary,
  },

  // 3. Categories (Circular pastel items matching reference UI)
  categoriesScroll: {
    paddingHorizontal: spacing.screenGutter,
    paddingVertical: spacing.xs,
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: spacing.md,
    width: 68,
  },
  categoryCircle: {
    width: 62,
    height: 62,
    borderRadius: 31, // circular 31px
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  categoryLabel: {
    fontFamily: font.medium,
    fontSize: responsiveFont(11.5),
    color: color.textPrimary,
    textAlign: 'center',
  },

  // 4. Nearby Medical Shops Section
  storesSection: {
    paddingHorizontal: spacing.screenGutter,
    marginTop: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: color.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
  },
  emptyTitle: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(15),
    color: color.textPrimary,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontFamily: font.regular,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.md,
  },

  // 5. Popular Medicines Section
  medicinesScroll: {
    paddingHorizontal: spacing.screenGutter,
    paddingVertical: spacing.xs,
  },
  medicineCard: {
    width: 156,
    backgroundColor: color.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.border,
    padding: 10,
    marginRight: spacing.sm,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
  },
  discountPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: color.successLight,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    zIndex: 1,
  },
  discountPillText: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(9.5),
    color: color.successDark,
  },
  medicineIconBox: {
    width: '100%',
    height: 72,
    backgroundColor: color.primaryMuted,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  medicineName: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(13),
    color: color.textPrimary,
    marginBottom: 2,
  },
  medicineComposition: {
    fontFamily: font.regular,
    fontSize: responsiveFont(10.5),
    color: color.textSecondary,
    marginBottom: 2,
  },
  medicinePackSize: {
    fontFamily: font.regular,
    fontSize: responsiveFont(10),
    color: color.textMuted,
    marginBottom: 8,
  },
  medicineFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  medPrice: {
    fontFamily: font.bold,
    fontSize: responsiveFont(14),
    color: color.textPrimary,
  },
  medMrp: {
    fontFamily: font.regular,
    fontSize: responsiveFont(11),
    color: color.textMuted,
    textDecorationLine: 'line-through',
  },
  addBtn: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 48,
    alignItems: 'center',
  },
  addBtnText: {
    fontFamily: font.bold,
    fontSize: responsiveFont(11),
    color: color.primary,
  },

  // Location Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: color.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.screenGutter,
    paddingBottom: spacing.xxl,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontFamily: font.bold,
    fontSize: responsiveFont(17),
    color: color.textPrimary,
  },
  modalCloseText: {
    fontSize: responsiveFont(18),
    color: color.textSecondary,
    padding: 4,
  },
  pincodeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  pincodeInput: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: 12,
    fontFamily: font.regular,
    fontSize: responsiveFont(13),
    color: color.textPrimary,
    backgroundColor: '#F8FAFC',
  },
  pincodeApplyBtn: {
    height: 46,
    paddingHorizontal: 16,
    backgroundColor: color.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pincodeApplyText: {
    fontFamily: font.bold,
    fontSize: responsiveFont(13),
    color: color.white,
  },
  useGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.divider,
    marginBottom: spacing.md,
  },
  useGpsText: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(13),
    color: color.primary,
  },
  cityChipsTitle: {
    fontFamily: font.semiBold,
    fontSize: responsiveFont(12),
    color: color.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  cityChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cityChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  cityChipActive: {
    backgroundColor: color.primaryLight,
    borderWidth: 1,
    borderColor: color.primary,
  },
  cityChipText: {
    fontFamily: font.medium,
    fontSize: responsiveFont(12),
    color: color.textPrimary,
  },
  cityChipTextActive: {
    color: color.primary,
    fontFamily: font.bold,
  },
});

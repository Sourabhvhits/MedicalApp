/**
 * Medical SaaS App - Design System Colors
 * Crisp Indian Pharmacy & Medicine Delivery aesthetic
 * (Blinkit / 1mg meets modern Apple Health)
 */

const color = {
  // Brand Colors: Deep Medical Teal & Mint Highlights
  primary: '#0D9488', // Deep Medical Teal
  primaryDark: '#0F766E', // Teal 700
  primaryLight: '#CCFBF1', // Mint / Soft Teal 100 for badges and highlights
  primaryMuted: '#F0FDFA', // Soft Teal Tint 50 for banner backgrounds

  secondary: '#0284C7', // Clinical Sky Blue for secondary indicators
  secondaryLight: '#E0F2FE',

  // Background & Surfaces (Soft hospital off-white & pure white cards)
  background: '#F8FAFC', // Soft off-white
  surface: '#FFFFFF', // Pure white
  card: '#FFFFFF',

  // Typography (Slate Dark & Slate Gray)
  textPrimary: '#0F172A', // Slate Dark 900 for headings
  textSecondary: '#64748B', // Slate Gray 500 for secondary info
  textMuted: '#94A3B8', // Slate 400 for placeholders
  textDisabled: '#CBD5E1',

  // Inputs
  inputBackground: '#FFFFFF',
  inputBorder: '#E2E8F0',
  inputBorderFocused: '#0D9488',
  inputPlaceholder: '#94A3B8',

  // Clinical Status & Badges
  success: '#16A34A', // Green 600
  successLight: '#DCFCE7', // Soft green pill background
  successDark: '#166534', // Dark green text for OPEN status
  warning: '#D97706', // Amber 600
  warningLight: '#FEF3C7',
  error: '#DC2626', // Red 600
  errorLight: '#FEE2E2',
  info: '#0284C7',
  infoLight: '#E0F2FE',

  // Soft Pastel Category Backgrounds
  catPain: '#FEF2F2', // Soft Rose
  catDiabetes: '#EFF6FF', // Soft Sky
  catVitamins: '#FFFBEB', // Soft Amber
  catHeart: '#F0FDF4', // Soft Mint
  catSkin: '#FAF5FF', // Soft Lavender

  // Structural & Dividers
  border: '#E2E8F0', // Subtle 1px solid border
  borderDark: '#CBD5E1',
  divider: '#F1F5F9', // Hairline divider

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

export default color;
export type ColorType = typeof color;

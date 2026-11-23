import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base guide dimensions matching standard modern mobile screens (e.g., iPhone 11/13/14)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export const responsiveWidth = (size: number): number => {
  return Math.round((SCREEN_WIDTH / BASE_WIDTH) * size);
};

export const responsiveHeight = (size: number): number => {
  return Math.round((SCREEN_HEIGHT / BASE_HEIGHT) * size);
};

export const responsiveFont = (size: number): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export { SCREEN_WIDTH, SCREEN_HEIGHT };

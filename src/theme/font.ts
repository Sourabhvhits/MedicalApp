import { Platform } from 'react-native';

const font = {
  regular: Platform.select({ ios: 'Poppins-Regular', android: 'Poppins-Regular' }) as string,
  medium: Platform.select({ ios: 'Poppins-Medium', android: 'Poppins-Medium' }) as string,
  semiBold: Platform.select({ ios: 'Poppins-SemiBold', android: 'Poppins-SemiBold' }) as string,
  bold: Platform.select({ ios: 'Poppins-Bold', android: 'Poppins-Bold' }) as string,

  PoppinsRegular: 'Poppins-Regular',
  PoppinsMedium: 'Poppins-Medium',
  PoppinsSemiBold: 'Poppins-SemiBold',
  PoppinsBold: 'Poppins-Bold',
};

export default font;

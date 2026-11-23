import { NavigatorScreenParams } from '@react-navigation/native';
import { BottomTabParams } from '../bottomTab/BottomTab';

export type RootStackParams = {
  // Auth routes
  login: undefined;
  register: { type?: 'CUSTOMER' | 'RETAILER' | 'VENDOR' } | undefined;
  forgot: undefined;
  otpVerify: {
    identifier: string;
    purpose: 'LOGIN' | 'REGISTRATION' | 'FORGOT_PASSWORD' | 'PHONE_VERIFICATION';
    devCode?: string;
  };
  resetPassword: {
    identifier: string;
    code?: string;
  };

  // App routes
  bottomTab: NavigatorScreenParams<BottomTabParams> | undefined;
  storeDetail: { id: string; storeName?: string };
  productSearch: { initialQuery?: string } | undefined;
  cart: undefined;
  checkout: {
    retailerId: string;
    storeName?: string;
    totals: { subtotal: number; taxTotal: number; total: number };
    prescriptionRequired?: boolean;
  };
  orderHistory: undefined;
  orderDetail: { orderId: string };
  categories: undefined;
  storesList: undefined;
  homePlaceholder: undefined;
};

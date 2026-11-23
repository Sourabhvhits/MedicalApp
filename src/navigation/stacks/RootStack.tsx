import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParams } from './rootStackParams';
import { useAppSelector } from '../../hooks/useRedux';

// Screens
import Login from '../../screens/auth/login/Login';
import Register from '../../screens/auth/register/Register';
import Forgot from '../../screens/auth/forgot/Forgot';
import OtpVerify from '../../screens/auth/otpVerify/OtpVerify';
import ResetPassword from '../../screens/auth/resetPassword/ResetPassword';
import BottomTab from '../bottomTab/BottomTab';
import StoreDetail from '../../screens/home/storeDetail/StoreDetail';
import ProductSearch from '../../screens/home/productSearch/ProductSearch';
import Cart from '../../screens/home/cart/Cart';
import Checkout from '../../screens/home/checkout/Checkout';
import OrderHistory from '../../screens/home/orderHistory/OrderHistory';
import OrderDetail from '../../screens/home/orderDetail/OrderDetail';
import Categories from '../../screens/home/categories/Categories';
import StoresList from '../../screens/home/storesList/StoresList';
import HomePlaceholder from '../../screens/home/homePlaceholder/HomePlaceholder';

const Stack = createNativeStackNavigator<RootStackParams>();

export const RootStack: React.FC = () => {
  const { isAuthenticated, user } = useAppSelector((state) => state.userReducer);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {isAuthenticated ? (
        user?.userType === 'CUSTOMER' ? (
          <>
            <Stack.Screen name="bottomTab" component={BottomTab} />
            <Stack.Screen name="storeDetail" component={StoreDetail} />
            <Stack.Screen name="productSearch" component={ProductSearch} />
            <Stack.Screen name="cart" component={Cart} />
            <Stack.Screen name="checkout" component={Checkout} />
            <Stack.Screen name="orderHistory" component={OrderHistory} />
            <Stack.Screen name="orderDetail" component={OrderDetail} />
            <Stack.Screen name="categories" component={Categories} />
            <Stack.Screen name="storesList" component={StoresList} />
          </>
        ) : (
          <>
            <Stack.Screen name="homePlaceholder" component={HomePlaceholder} />
            <Stack.Screen name="bottomTab" component={BottomTab} />
            <Stack.Screen name="storeDetail" component={StoreDetail} />
            <Stack.Screen name="productSearch" component={ProductSearch} />
            <Stack.Screen name="cart" component={Cart} />
            <Stack.Screen name="checkout" component={Checkout} />
            <Stack.Screen name="orderHistory" component={OrderHistory} />
            <Stack.Screen name="orderDetail" component={OrderDetail} />
            <Stack.Screen name="categories" component={Categories} />
            <Stack.Screen name="storesList" component={StoresList} />
          </>
        )
      ) : (
        <>
          <Stack.Screen name="login" component={Login} />
          <Stack.Screen name="register" component={Register} />
          <Stack.Screen name="forgot" component={Forgot} />
          <Stack.Screen name="otpVerify" component={OtpVerify} />
          <Stack.Screen name="resetPassword" component={ResetPassword} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default RootStack;

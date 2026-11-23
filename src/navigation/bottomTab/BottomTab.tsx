import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from './bottomTab.style';
import color from '../../theme/color';

// Screens
import StoreDiscovery from '../../screens/home/storeDiscovery/StoreDiscovery';
import ProductSearch from '../../screens/home/productSearch/ProductSearch';
import Cart from '../../screens/home/cart/Cart';
import OrderHistory from '../../screens/home/orderHistory/OrderHistory';
import CustomerProfile from '../../screens/home/customerProfile/CustomerProfile';

// Icons
import { StoreIcon } from '../../assets/svg/StoreIcon';
import { SearchIcon } from '../../assets/svg/SearchIcon';
import { CartIcon } from '../../assets/svg/CartIcon';
import { ClockIcon } from '../../assets/svg/ClockIcon';
import { UserIcon } from '../../assets/svg/UserIcon';

export type BottomTabParams = {
  storesTab: undefined;
  searchTab: undefined;
  cartTab: undefined;
  ordersTab: undefined;
  profileTab: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParams>();

const renderStoresIcon = ({ color: tintColor, focused }: { color: string; focused: boolean }) => (
  <StoreIcon width={22} height={22} color={tintColor} focused={focused} />
);
const renderSearchIcon = ({ color: tintColor }: { color: string }) => (
  <SearchIcon width={22} height={22} color={tintColor} />
);
const renderCartIcon = ({ color: tintColor }: { color: string }) => (
  <CartIcon width={22} height={22} color={tintColor} />
);
const renderOrdersIcon = ({ color: tintColor }: { color: string }) => (
  <ClockIcon width={22} height={22} color={tintColor} />
);
const renderProfileIcon = ({ color: tintColor }: { color: string }) => (
  <UserIcon width={22} height={22} color={tintColor} />
);

export const BottomTab: React.FC = () => {
  const insets = useSafeAreaInsets();
  // Safe clearance for Android 3-button navigation and gesture bar
  const bottomPadding = Platform.OS === 'android'
    ? Math.max(insets.bottom, 22)
    : Math.max(insets.bottom, 10);
  const tabHeight = 60 + bottomPadding;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: tabHeight,
            paddingBottom: bottomPadding,
          },
        ],
        tabBarItemStyle: styles.tabItem,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.textSecondary,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="storesTab"
        component={StoreDiscovery}
        options={{
          tabBarLabel: 'Stores',
          tabBarIcon: renderStoresIcon,
        }}
      />

      <Tab.Screen
        name="searchTab"
        component={ProductSearch}
        options={{
          tabBarLabel: 'Search',
          tabBarIcon: renderSearchIcon,
        }}
      />

      <Tab.Screen
        name="cartTab"
        component={Cart}
        options={{
          tabBarLabel: 'Cart',
          tabBarIcon: renderCartIcon,
        }}
      />

      <Tab.Screen
        name="ordersTab"
        component={OrderHistory}
        options={{
          tabBarLabel: 'Orders',
          tabBarIcon: renderOrdersIcon,
        }}
      />

      <Tab.Screen
        name="profileTab"
        component={CustomerProfile}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: renderProfileIcon,
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomTab;

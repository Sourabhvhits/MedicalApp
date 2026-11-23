import { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParams } from '../../../navigation/stacks/rootStackParams';
import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux';
import { logout } from '../../../services/redux/userReducer/reducer';
import { axiosInstance } from '../../../services/api';
import constant from '../../../services/config/constant';
import { ToastSuccess } from '../../../utility/toast';

export interface AddressItem {
  id: string;
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  isDefault?: boolean;
}

const DEFAULT_FALLBACK_ADDRESSES: AddressItem[] = [
  {
    id: 'addr-01',
    label: 'Home',
    line1: 'Flat 402, Green Valley Apartments',
    line2: 'FC Road, Shivaji Nagar',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411005',
    isDefault: true,
  },
];

export const useCustomerProfile = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.userReducer.user);

  const [addresses, setAddresses] = useState<AddressItem[]>(DEFAULT_FALLBACK_ADDRESSES);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const fetchAddresses = async () => {
      try {
        const response = await axiosInstance.get('/customers/addresses');
        const list = response.data?.data || [];
        if (list.length > 0) {
          setAddresses(list);
        }
      } catch {
        // Fallback gracefully
      }
    };
    fetchAddresses();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await axiosInstance.post(constant.logout).catch(() => {});
      dispatch(logout());
      ToastSuccess('Logged out successfully.');
    } catch {
      dispatch(logout());
    } finally {
      setLoggingOut(false);
    }
  };

  const navigateToOrders = () => {
    navigation.navigate('orderHistory');
  };

  return {
    user,
    addresses,
    loggingOut,
    handleLogout,
    navigateToOrders,
  };
};

export default useCustomerProfile;

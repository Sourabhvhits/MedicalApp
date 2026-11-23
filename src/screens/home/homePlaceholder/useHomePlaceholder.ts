import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParams } from '../../../navigation/stacks/rootStackParams';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import { logout } from '@redux/userReducer/reducer';
import { axiosInstance } from '@api/api';
import constant from '@config/constant';
import { ToastSuccess } from '@utility/toast';

export const useHomePlaceholder = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.userReducer.user);
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await axiosInstance.post(constant.logout).catch(() => {});
      dispatch(logout());
      ToastSuccess('Logged out successfully.');
    } catch {
      dispatch(logout());
    } finally {
      setLoading(false);
    }
  };

  const navigateToCustomerStore = () => {
    navigation.navigate('bottomTab');
  };

  return {
    user,
    loading,
    handleLogout,
    navigateToCustomerStore,
  };
};

export default useHomePlaceholder;

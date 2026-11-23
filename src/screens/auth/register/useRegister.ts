import { useFormik } from 'formik';
import { initialValues, formSchema } from './register.formik';
import { useAuthNavigation } from '@hooks/useAppNavigation';
import { useAppDispatch } from '@hooks/useRedux';
import { loginSuccess } from '@redux/userReducer/reducer';
import { axiosInstance } from '@api/api';
import constant from '@config/constant';
import { ToastError, ToastSuccess } from '@utility/toast';
import { cleanErrorMessage } from '@utility/common';

export const ACCOUNT_ROLES = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'RETAILER', label: 'Medical Shop' },
  { value: 'VENDOR', label: 'Wholesaler' },
] as const;

export const useRegister = () => {
  const navigation = useAuthNavigation();
  const dispatch = useAppDispatch();

  const formik = useFormik({
    initialValues,
    validationSchema: formSchema,
    onSubmit: async (values, { setFieldValue }) => {
      setFieldValue('isLoading', true);
      try {
        const isBusiness = values.userType !== 'CUSTOMER';
        const payload: any = {
          userType: values.userType,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim() || undefined,
          phone: values.phone.trim(),
          password: values.password,
          email: values.email.trim() || undefined,
          businessName: isBusiness ? values.businessName.trim() : undefined,
        };

        const response = await axiosInstance.post(constant.register, payload);
        const data = response.data?.data;

        if (data?.user && data?.tokens) {
          dispatch(loginSuccess({ user: data.user, tokens: data.tokens }));
          if (isBusiness) {
            ToastSuccess('Account created! Your business credentials are in review.');
          } else {
            ToastSuccess('Welcome to MedMarket!');
          }
        } else {
          ToastSuccess('Registration completed successfully! Please sign in.');
          navigation.navigate('login');
        }
      } catch (err: any) {
        const msg = cleanErrorMessage(err, 'Failed to register. Please check your details.');
        ToastError(msg);
      } finally {
        setFieldValue('isLoading', false);
      }
    },
  });

  const selectUserType = (type: 'CUSTOMER' | 'RETAILER' | 'VENDOR') => {
    formik.setFieldValue('userType', type);
  };

  const navigateToLogin = () => navigation.navigate('login');

  return {
    formik,
    loading: formik.values.isLoading,
    selectUserType,
    navigateToLogin,
  };
};

export default useRegister;

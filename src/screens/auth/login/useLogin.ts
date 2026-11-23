import { useFormik } from 'formik';
import { initialValues, formSchema } from './login.formik';
import { useAuthNavigation } from '@hooks/useAppNavigation';
import { useAppDispatch } from '@hooks/useRedux';
import { loginSuccess } from '@redux/userReducer/reducer';
import { axiosInstance } from '@api/api';
import constant from '@config/constant';
import { ToastError, ToastSuccess } from '@utility/toast';
import { cleanErrorMessage } from '@utility/common';

export const DEMO_USERS = [
  { label: 'Customer', id: 'customer1@medsaas.test', pass: 'Demo@12345' },
  { label: 'Medical Shop', id: 'shop1@medsaas.test', pass: 'Demo@12345' },
  { label: 'Wholesaler', id: 'vendor1@medsaas.test', pass: 'Demo@12345' },
];

export const useLogin = () => {
  const navigation = useAuthNavigation();
  const dispatch = useAppDispatch();

  const formik = useFormik({
    initialValues,
    validationSchema: formSchema,
    onSubmit: async (values, { setFieldValue }) => {
      setFieldValue('isLoading', true);
      try {
        const response = await axiosInstance.post(constant.login, {
          identifier: values.identifier.trim(),
          password: values.password,
        });

        const data = response.data?.data;
        if (data?.user && data?.tokens) {
          dispatch(loginSuccess({ user: data.user, tokens: data.tokens }));
          ToastSuccess(`Welcome back, ${data.user.firstName}!`);
        } else {
          ToastError('Login succeeded but session data was incomplete.');
        }
      } catch (err: any) {
        const msg = cleanErrorMessage(err, 'Invalid credentials. Please try again.');
        ToastError(msg);
      } finally {
        setFieldValue('isLoading', false);
      }
    },
  });

  const handleDemoSelect = (id: string, pass: string) => {
    formik.setFieldValue('identifier', id);
    formik.setFieldValue('password', pass);
  };

  const navigateToRegister = () => navigation.navigate('register');
  const navigateToForgot = () => navigation.navigate('forgot');

  return {
    formik,
    loading: formik.values.isLoading,
    handleDemoSelect,
    navigateToRegister,
    navigateToForgot,
  };
};

export default useLogin;

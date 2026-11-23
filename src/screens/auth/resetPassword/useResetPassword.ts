import { useFormik } from 'formik';
import { initialValues, formSchema } from './resetPassword.formik';
import { useAuthNavigation, useAuthRoute } from '@hooks/useAppNavigation';
import { axiosInstance } from '@api/api';
import constant from '@config/constant';
import { ToastError, ToastSuccess } from '@utility/toast';
import { cleanErrorMessage } from '@utility/common';

export const useResetPassword = () => {
  const navigation = useAuthNavigation();
  const route = useAuthRoute<'resetPassword'>();

  const { identifier, code: prefilledCode } = route.params || {};

  const formik = useFormik({
    initialValues: {
      ...initialValues,
      code: prefilledCode || '',
    },
    validationSchema: formSchema,
    onSubmit: async (values, { setFieldValue }) => {
      setFieldValue('isLoading', true);
      try {
        await axiosInstance.post(constant.resetPassword, {
          identifier,
          code: values.code.trim(),
          newPassword: values.newPassword,
        });

        ToastSuccess('Password updated successfully! Please sign in.');
        navigation.navigate('login');
      } catch (err: any) {
        const msg = cleanErrorMessage(err, 'Could not reset password. Please check your verification code.');
        ToastError(msg);
      } finally {
        setFieldValue('isLoading', false);
      }
    },
  });

  return {
    formik,
    loading: formik.values.isLoading,
    identifier,
    goBack: () => navigation.goBack(),
  };
};

export default useResetPassword;

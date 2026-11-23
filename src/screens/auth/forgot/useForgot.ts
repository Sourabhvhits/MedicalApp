import { useFormik } from 'formik';
import { initialValues, formSchema } from './forgot.formik';
import { useAuthNavigation } from '@hooks/useAppNavigation';
import { axiosInstance } from '@api/api';
import constant from '@config/constant';
import { ToastError, ToastSuccess } from '@utility/toast';
import { cleanErrorMessage } from '@utility/common';

export const useForgot = () => {
  const navigation = useAuthNavigation();

  const formik = useFormik({
    initialValues,
    validationSchema: formSchema,
    onSubmit: async (values, { setFieldValue }) => {
      setFieldValue('isLoading', true);
      try {
        const response = await axiosInstance.post(constant.forgotPassword, {
          identifier: values.identifier.trim(),
        });

        const data = response.data?.data;
        ToastSuccess('Verification code has been sent!');

        navigation.navigate('otpVerify', {
          identifier: values.identifier.trim(),
          purpose: 'FORGOT_PASSWORD',
          devCode: data?.devCode,
        });
      } catch (err: any) {
        const msg = cleanErrorMessage(err, 'Failed to send reset code.');
        ToastError(msg);
      } finally {
        setFieldValue('isLoading', false);
      }
    },
  });

  return {
    formik,
    loading: formik.values.isLoading,
    goBack: () => navigation.goBack(),
  };
};

export default useForgot;

import { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import { initialValues, formSchema } from './otpVerify.formik';
import { useAuthNavigation, useAuthRoute } from '@hooks/useAppNavigation';
import { useAppDispatch } from '@hooks/useRedux';
import { loginSuccess } from '@redux/userReducer/reducer';
import { axiosInstance } from '@api/api';
import constant from '@config/constant';
import { ToastError, ToastSuccess } from '@utility/toast';
import { cleanErrorMessage } from '@utility/common';

export const useOtpVerify = () => {
  const navigation = useAuthNavigation();
  const route = useAuthRoute<'otpVerify'>();
  const dispatch = useAppDispatch();

  const { identifier, purpose, devCode: initialDevCode } = route.params || {};

  const [resending, setResending] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>(initialDevCode);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const formik = useFormik({
    initialValues: {
      ...initialValues,
      code: initialDevCode || '',
    },
    validationSchema: formSchema,
    onSubmit: async (values, { setFieldValue }) => {
      setFieldValue('isLoading', true);
      try {
        const response = await axiosInstance.post(constant.verifyOtp, {
          identifier,
          purpose,
          code: values.code.trim(),
        });

        const data = response.data?.data;

        if (purpose === 'FORGOT_PASSWORD') {
          ToastSuccess('Code verified! Set your new password.');
          navigation.navigate('resetPassword', {
            identifier,
            code: values.code.trim(),
          });
        } else if (data?.tokens && data?.user) {
          dispatch(loginSuccess({ user: data.user, tokens: data.tokens }));
          ToastSuccess('Verification successful!');
        } else {
          ToastSuccess('Verification successful!');
          navigation.navigate('login');
        }
      } catch (err: any) {
        const msg = cleanErrorMessage(err, 'Invalid or expired verification code.');
        ToastError(msg);
      } finally {
        setFieldValue('isLoading', false);
      }
    },
  });

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    try {
      const response = await axiosInstance.post(constant.sendOtp, {
        identifier,
        purpose,
      });
      const data = response.data?.data;
      if (data?.devCode) {
        setDevCode(data.devCode);
        formik.setFieldValue('code', data.devCode);
      }
      setCountdown(30);
      ToastSuccess('New verification code sent!');
    } catch (err: any) {
      const msg = cleanErrorMessage(err, 'Failed to resend code.');
      ToastError(msg);
    } finally {
      setResending(false);
    }
  };

  return {
    identifier,
    devCode,
    countdown,
    loading: formik.values.isLoading,
    resending,
    formik,
    handleResend,
    goBack: () => navigation.goBack(),
  };
};

export default useOtpVerify;

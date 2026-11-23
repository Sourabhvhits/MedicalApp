import * as Yup from 'yup';

// ── Reset Password Formik Configuration ─────────────────────────────────
const initialValues = {
  code: '',
  newPassword: '',
  confirmPassword: '',
  isLoading: false,
};

const formSchema = Yup.object().shape({
  code: Yup.string()
    .trim()
    .required('Verification code is required')
    .matches(/^\d{4,8}$/, 'Enter the verification code sent to you'),
  newPassword: Yup.string()
    .required('New password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/(?=.*[a-z])/, 'Password must contain a lowercase letter')
    .matches(/(?=.*[A-Z])/, 'Password must contain an uppercase letter')
    .matches(/(?=.*\d)/, 'Password must contain a number'),
  confirmPassword: Yup.string()
    .required('Confirm password is required')
    .oneOf([Yup.ref('newPassword')], 'Passwords do not match'),
});

export { formSchema, initialValues };
export type ResetPasswordFormValues = typeof initialValues;

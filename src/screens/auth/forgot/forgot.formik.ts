import * as Yup from 'yup';

// ── Forgot Password Formik Configuration ────────────────────────────────
const initialValues = {
  identifier: '',
  isLoading: false,
};

const formSchema = Yup.object().shape({
  identifier: Yup.string()
    .trim()
    .required('Email or mobile number is required')
    .min(3, 'Enter a valid email or 10-digit mobile number'),
});

export { formSchema, initialValues };
export type ForgotFormValues = typeof initialValues;

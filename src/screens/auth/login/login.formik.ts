import * as Yup from 'yup';

// ── Login Formik Configuration ──────────────────────────────────────────
// initialValues includes isLoading so the loading state is managed via
// setFieldValue('isLoading', true/false)
const initialValues = {
  identifier: '',
  password: '',
  isLoading: false,
};

const formSchema = Yup.object().shape({
  identifier: Yup.string()
    .trim()
    .required('Email or mobile number is required')
    .min(3, 'Enter a valid email or 10-digit mobile number'),
  password: Yup.string()
    .required('Password is required')
    .min(1, 'Password is required'),
});

export { formSchema, initialValues };
export type LoginFormValues = typeof initialValues;

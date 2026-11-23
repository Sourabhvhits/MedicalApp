import * as Yup from 'yup';
import { OTP_REGEX } from '@utility/validation/stringValidation';

// ── OTP Verify Formik Configuration ─────────────────────────────────────
const initialValues = {
  code: '',
  isLoading: false,
};

const formSchema = Yup.object().shape({
  code: Yup.string()
    .trim()
    .required('Verification code is required')
    .matches(OTP_REGEX, 'Enter the verification code sent to you'),
});

export { formSchema, initialValues };
export type OtpVerifyFormValues = typeof initialValues;

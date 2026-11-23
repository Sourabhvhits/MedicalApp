import * as Yup from 'yup';
import { PHONE_REGEX } from '@utility/validation/stringValidation';

// ── Register Formik Configuration ───────────────────────────────────────
const initialValues = {
  userType: 'CUSTOMER' as 'CUSTOMER' | 'RETAILER' | 'VENDOR',
  firstName: '',
  lastName: '',
  businessName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  isLoading: false,
};

const formSchema = Yup.object().shape({
  userType: Yup.string()
    .oneOf(['CUSTOMER', 'RETAILER', 'VENDOR'])
    .required('Account type is required'),
  firstName: Yup.string()
    .trim()
    .required('First name is required')
    .min(2, 'First name must be at least 2 characters'),
  lastName: Yup.string().trim().optional(),
  phone: Yup.string()
    .trim()
    .required('Mobile number is required')
    .matches(PHONE_REGEX, 'Enter a valid 10-digit mobile number'),
  email: Yup.string()
    .trim()
    .when('userType', {
      is: (val: string) => val !== 'CUSTOMER',
      then: (schema) =>
        schema
          .required('Business accounts require an email address')
          .email('Enter a valid email address'),
      otherwise: (schema) => schema.email('Enter a valid email address').optional(),
    }),
  businessName: Yup.string()
    .trim()
    .when('userType', {
      is: (val: string) => val !== 'CUSTOMER',
      then: (schema) =>
        schema
          .required('Registered business name is required')
          .min(2, 'Registered business name is required'),
      otherwise: (schema) => schema.optional(),
    }),
  password: Yup.string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/(?=.*[a-z])/, 'Password must contain a lowercase letter')
    .matches(/(?=.*[A-Z])/, 'Password must contain an uppercase letter')
    .matches(/(?=.*\d)/, 'Password must contain a number'),
  confirmPassword: Yup.string()
    .required('Confirm password is required')
    .oneOf([Yup.ref('password')], 'Passwords do not match'),
});

export { formSchema, initialValues };
export type RegisterFormValues = typeof initialValues;

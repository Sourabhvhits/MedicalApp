import * as Yup from 'yup';
import { validationMessage } from './validationMessage';

export const phoneRegex = /^[6-9]\d{9}$/;
export const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;
export const otpRegex = /^\d{4,8}$/;

// Uppercase aliases matching the user's reference pattern
export const PHONE_REGEX = phoneRegex;
export const PASSWORD_REGEX = passwordRegex;
export const OTP_REGEX = otpRegex;

export const loginValidationSchema = Yup.object().shape({
  identifier: Yup.string()
    .trim()
    .required(validationMessage.required('Email or mobile number'))
    .min(3, validationMessage.invalidIdentifier),
  password: Yup.string()
    .required(validationMessage.required('Password'))
    .min(1, validationMessage.required('Password')),
});

export const registerValidationSchema = Yup.object().shape({
  userType: Yup.string()
    .oneOf(['CUSTOMER', 'RETAILER', 'VENDOR'])
    .required(validationMessage.required('Account type')),
  firstName: Yup.string()
    .trim()
    .required(validationMessage.required('First name'))
    .min(2, 'First name must be at least 2 characters'),
  lastName: Yup.string().trim().optional(),
  phone: Yup.string()
    .trim()
    .required(validationMessage.required('Mobile number'))
    .matches(PHONE_REGEX, validationMessage.invalidPhone),
  email: Yup.string()
    .trim()
    .when('userType', {
      is: (val: string) => val !== 'CUSTOMER',
      then: (schema) => schema.required('Business accounts require an email address').email(validationMessage.invalidEmail),
      otherwise: (schema) => schema.email(validationMessage.invalidEmail).optional(),
    }),
  businessName: Yup.string()
    .trim()
    .when('userType', {
      is: (val: string) => val !== 'CUSTOMER',
      then: (schema) => schema.required(validationMessage.businessNameRequired).min(2, validationMessage.businessNameRequired),
      otherwise: (schema) => schema.optional(),
    }),
  password: Yup.string()
    .required(validationMessage.required('Password'))
    .min(8, validationMessage.passwordMin)
    .matches(/(?=.*[a-z])/, validationMessage.passwordLowercase)
    .matches(/(?=.*[A-Z])/, validationMessage.passwordUppercase)
    .matches(/(?=.*\d)/, validationMessage.passwordNumber),
  confirmPassword: Yup.string()
    .required(validationMessage.required('Confirm password'))
    .oneOf([Yup.ref('password')], validationMessage.passwordsDoNotMatch),
});

export const forgotPasswordValidationSchema = Yup.object().shape({
  identifier: Yup.string()
    .trim()
    .required(validationMessage.required('Email or mobile number'))
    .min(3, validationMessage.invalidIdentifier),
});

export const otpVerifyValidationSchema = Yup.object().shape({
  code: Yup.string()
    .trim()
    .required(validationMessage.required('Verification code'))
    .matches(OTP_REGEX, validationMessage.otpInvalid),
});

export const resetPasswordValidationSchema = Yup.object().shape({
  code: Yup.string()
    .trim()
    .required(validationMessage.required('Verification code'))
    .matches(OTP_REGEX, validationMessage.otpInvalid),
  newPassword: Yup.string()
    .required(validationMessage.required('New password'))
    .min(8, validationMessage.passwordMin)
    .matches(/(?=.*[a-z])/, validationMessage.passwordLowercase)
    .matches(/(?=.*[A-Z])/, validationMessage.passwordUppercase)
    .matches(/(?=.*\d)/, validationMessage.passwordNumber),
  confirmPassword: Yup.string()
    .required(validationMessage.required('Confirm password'))
    .oneOf([Yup.ref('newPassword')], validationMessage.passwordsDoNotMatch),
});

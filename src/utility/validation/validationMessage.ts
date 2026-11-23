export const validationMessage = {
  required: (field: string) => `${field} is required`,
  invalidEmail: 'Enter a valid email address',
  invalidPhone: 'Enter a valid 10-digit mobile number',
  invalidIdentifier: 'Enter a valid email or 10-digit mobile number',
  passwordMin: 'Password must be at least 8 characters',
  passwordLowercase: 'Password must contain a lowercase letter',
  passwordUppercase: 'Password must contain an uppercase letter',
  passwordNumber: 'Password must contain a number',
  passwordsDoNotMatch: 'Passwords do not match',
  otpInvalid: 'Enter the verification code sent to you',
  businessNameRequired: 'Registered business name is required',
};

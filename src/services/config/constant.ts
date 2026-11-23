

const constant = {
  baseURL: `https://8p3w6fkf-5000.inc1.devtunnels.ms/api/v1`,
  timeout: 15000,
  // Auth endpoints
  login: '/auth/login',
  register: '/auth/register',
  sendOtp: '/auth/send-otp',
  verifyOtp: '/auth/verify-otp',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  changePassword: '/auth/change-password',
  me: '/auth/me',
  sessions: '/auth/sessions',

  // Storage keys
  storageKey: '@medical_app_storage',
  tokenKey: '@medical_app_token',
};

export default constant;

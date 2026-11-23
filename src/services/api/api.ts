import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import constant from '@config/constant';
import { store } from '@redux/store';
import { logout, updateTokens } from '@redux/userReducer/reducer';
import { resetAndNavigate } from '@utility/navigationService';
import { ToastError } from '@utility/toast';

const axiosInstance = axios.create({
  baseURL: constant.baseURL,
  timeout: constant.timeout,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { token } = store.getState().userReducer;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const status = error.response?.status;

    // Check if 401 Unauthorized and not already retried
    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/register');

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      const { refreshToken } = store.getState().userReducer;

      if (!refreshToken) {
        store.dispatch(logout());
        resetAndNavigate('login');
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          `${constant.baseURL}${constant.refresh}`,
          { refreshToken },
        );

        const newTokens = refreshResponse.data?.data?.tokens;
        if (newTokens?.accessToken) {
          store.dispatch(updateTokens(newTokens));
          processQueue(null, newTokens.accessToken);
          originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          return axiosInstance(originalRequest);
        } else {
          throw new Error('Refresh token invalid');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        store.dispatch(logout());
        ToastError('Session expired. Please log in again.');
        resetAndNavigate('login');
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export { axiosInstance };
export default axiosInstance;

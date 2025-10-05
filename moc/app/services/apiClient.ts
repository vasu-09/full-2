import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  updateSessionTokens,
} from './authStorage';


type ExpoConfig = typeof Constants.expoConfig & {
  debuggerHost?: string | null;
  extra?: Record<string, any> | undefined;
};

const expoConfig: ExpoConfig | null = (Constants.expoConfig ?? Constants.manifest) as ExpoConfig | null;

const extractHost = (value?: string | null) => {
  if (!value) {
    return undefined;
  }

  try {
    const prefixed = value.match(/^[a-zA-Z]+:\/\//) ? value : `http://${value}`;
    const parsed = new URL(prefixed);
    if (parsed.hostname) {
      return parsed.hostname;
    }
  } catch {
    // Fall back to manual parsing below
  }

  const sanitized = value
    .replace(/^[a-zA-Z]+:\/\//, '')
    .split('/')[0]
    .split('@')
    .pop();

  return sanitized?.split(':')[0];
};

const getDebuggerHost = () => {
  if (!expoConfig) {
    return undefined;
  }

  const extraHost = extractHost(expoConfig?.extra?.apiHost ?? expoConfig?.extra?.apiBaseUrl);
  if (extraHost) {
    return extraHost;
  }

  const hostUriHost = extractHost(expoConfig?.hostUri);
  if (hostUriHost) {
    return hostUriHost;
  }

  const debuggerHost = extractHost(expoConfig?.debuggerHost);
  if (debuggerHost) {
    return debuggerHost;
  }

  const expoGoDebugHost = extractHost(Constants?.expoGoConfig?.debuggerHost);
  if (expoGoDebugHost) {
    return expoGoDebugHost;
  }

  return undefined;
};

const resolveLocalhost = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8080';
  }

  if (Platform.OS === 'ios') {
    return 'http://127.0.0.1:8080';
  }

  return 'http://localhost:8080';
};

const getBaseURL = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const host = getDebuggerHost();

  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return resolveLocalhost();
  }

  return `http://${host}:8080`;
};

export const apiBaseURL = getBaseURL();

const apiClient = axios.create({
  baseURL: apiBaseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        return null;
      }

      try {
        const { data } = await axios.post(
          `${apiBaseURL}/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } },
        );

        await updateSessionTokens({
          accessToken: data?.accessToken ?? null,
          refreshToken: data?.refreshToken ?? null,
          sessionId: data?.sessionId ?? undefined,
          issuedAt: data?.issuedAt ?? undefined,
        });

        if (data?.accessToken) {
          return data.accessToken as string;
        }

        return null;
      } catch {
        await clearSession();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
};

apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    if (!config.headers) {
      config.headers = {};
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      const newToken = await refreshAccessToken();
      if (newToken) {
        if (!originalRequest.headers) {
          originalRequest.headers = {};
        }
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);


export default apiClient;
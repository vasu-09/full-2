import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

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

const getScriptUrlHost = () => {
  const sourceCodeModule = NativeModules?.SourceCode as { scriptURL?: string } | undefined;
  const scriptUrl = sourceCodeModule?.scriptURL;
  if (!scriptUrl) {
    return undefined;
  }

  return extractHost(scriptUrl);
};

const isExpoHosted = (host?: string) => {
  if (!host) {
    return false;
  }

  return host === 'exp.host' || host === 'u.expo.dev' || host.endsWith('.expo.dev') || host.endsWith('.exp.direct');
};

const getBundlerHost = () => {
  const scriptHost = getScriptUrlHost();
  if (scriptHost) {
    return scriptHost;
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname;
  }

  return getDebuggerHost();
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

const normalizeBaseUrl = (value?: string | null, { appendDefaultPort = false } = {}) => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const prefixed = trimmed.match(/^[a-zA-Z]+:\/\//) ? trimmed : `http://${trimmed}`;

  try {
    const parsed = new URL(prefixed);
    if (appendDefaultPort && !parsed.port) {
      parsed.port = '8080';
    }
    parsed.pathname = parsed.pathname.replace(/\/$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return prefixed.replace(/\/$/, '');
  }
};

const getExplicitBaseUrl = () => {
  const extra = expoConfig?.extra ?? {};

  const rawBase =
    extra?.apiBaseUrl ??
    extra?.apiBaseURL ??
    extra?.apiUrl ??
    extra?.apiURL ??
    (process.env.EXPO_PUBLIC_API_URL ?? undefined);

  const baseFromExtra = normalizeBaseUrl(typeof rawBase === 'string' ? rawBase : undefined);
  if (baseFromExtra) {
    return baseFromExtra;
  }

  const hostOnly = extra?.apiHost ?? extra?.apiHostname;
  if (typeof hostOnly === 'string' && hostOnly.trim()) {
    return normalizeBaseUrl(hostOnly, { appendDefaultPort: true });
  }

  return undefined;
};

const getBaseURL = () => {
  const explicitBase = getExplicitBaseUrl();
  if (explicitBase) {
    return explicitBase;
  }

  const host = getBundlerHost();

  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1' || isExpoHosted(host)) {
    return resolveLocalhost();
  }

  return `http://${host}:8080`;
};

export const apiBaseURL = getBaseURL();

export const buildWsUrl = (baseUrl: string = apiBaseURL) => {
  try {
    const parsed = new URL(baseUrl);
    const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    parsed.protocol = protocol;
    parsed.pathname = parsed.pathname.replace(/\/$/, '') + '/ws';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    const normalized = baseUrl.replace(/\/$/, '');
    if (normalized.startsWith('https://')) {
      return `${normalized.replace(/^https:\/\//, 'wss://')}/ws`;
    }
    if (normalized.startsWith('http://')) {
      return `${normalized.replace(/^http:\/\//, 'ws://')}/ws`;
    }
    return `ws://${normalized}/ws`;
  }
};

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
    const headers = AxiosHeaders.from(config.headers ?? {});
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
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
        const headers = AxiosHeaders.from(originalRequest.headers ?? {});
        headers.set('Authorization', `Bearer ${newToken}`);
        originalRequest.headers = headers;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);


export default apiClient;
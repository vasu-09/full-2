import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  updateSessionTokens,
} from './authStorage';


type DeveloperInfo = {
  url?: string | null;
  hostname?: string | null;
  host?: string | null;
  metroHostname?: string | null;
  metroHost?: string | null;
};

type ExpoConfig = (typeof Constants.expoConfig) & {
  debuggerHost?: string | null;
  extra?: Record<string, any> | undefined;
  developer?: DeveloperInfo | string | null;
};

type Manifest2 = {
  extra?: {
    expoClient?: ExpoConfig;
    expoGo?: ExpoConfig;
  };
};

const manifest2 = (Constants.manifest2 ?? null) as Manifest2 | null;
const manifest2Config = manifest2?.extra?.expoClient ?? manifest2?.extra?.expoGo ?? null;

const expoConfig: ExpoConfig | null = (Constants.expoConfig ?? Constants.manifest ?? manifest2Config ?? null) as ExpoConfig | null;

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

  const extraHost = extractHost(expoConfig?.extra?.apiHost ?? expoConfig?.extra?.apiBaseUrl);
  if (extraHost) {
    return extraHost;
  }

  const hostUriHost = extractHost(expoConfig?.hostUri ?? Constants?.expoGoConfig?.hostUri);
  if (hostUriHost) {
    return hostUriHost;
  }

   const debuggerHost = extractHost(expoConfig?.debuggerHost ?? Constants?.expoGoConfig?.debuggerHost);
  if (debuggerHost) {
    return debuggerHost;
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

const getNativeServerHost = () => {
  if (Platform.OS === 'android') {
    const { ServerHost, serverHost } = getAndroidConstants();
    const hostValue = ServerHost ?? serverHost;
    if (hostValue) {
      const parsed = extractHost(hostValue);
      if (parsed) {
        return parsed;
      }

      const withoutPort = hostValue.split(':')[0];
      if (withoutPort) {
        return withoutPort;
      }
    }
  }

  return undefined;
};

const getBundlerHost = () => {
  const nativeHost = getNativeServerHost();
  if (nativeHost) {
    return nativeHost;
  }

  const scriptHost = getScriptUrlHost();
  if (scriptHost) {
    return scriptHost;
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname;
  }

  return getDebuggerHost();
};

const getAndroidConstants = () => {
  const constants = (Platform as typeof Platform & { constants?: Record<string, any> }).constants;
  return constants ?? {};
};

const isAndroidEmulator = () => {
  if (Platform.OS !== 'android') {
    return false;
  }

  const { Brand = '', Model = '', Fingerprint = '' } = getAndroidConstants();
  const normalizedBrand = String(Brand).toLowerCase();
  const normalizedModel = String(Model).toLowerCase();
  const normalizedFingerprint = String(Fingerprint).toLowerCase();

  if (normalizedBrand.includes('generic') || normalizedBrand.includes('unknown')) {
    return true;
  }

  if (
    normalizedModel.includes('emulator') ||
    normalizedModel.includes('android sdk built for x86') ||
    normalizedModel.includes('sdk_gphone') ||
    normalizedModel.includes('sdk')
  ) {
    return true;
  }

  if (normalizedFingerprint.startsWith('generic') || normalizedFingerprint.startsWith('unknown')) {
    return true;
  }

  return false;
};

const resolveLocalhost = () => {
  if (Platform.OS === 'android') {
     return isAndroidEmulator() ? 'http://10.0.2.2:8080' : 'http://127.0.0.1:8080';
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
  const extra = expoConfig?.extra ?? manifest2Config?.extra ?? {};

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

const isLoopbackHost = (host?: string | null) => {
  if (!host) {
    return false;
  }

  const normalized = host.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
};

type DeveloperLike = DeveloperInfo | string | null | undefined;

const extractDeveloperHost = (value: DeveloperLike) => {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    return extractHost(value) ?? (isLoopbackHost(value) ? undefined : value);
  }

  const urlCandidate = extractHost(value.url ?? undefined);
  if (urlCandidate) {
    return urlCandidate;
  }

  const fallbackFields = [value.hostname, value.host, value.metroHostname, value.metroHost];
  for (const field of fallbackFields) {
    if (!field) {
      continue;
    }

    const host = extractHost(field) ?? field;
    if (host) {
      return host;
    }
  }

  return undefined;
};

const getLocalNetworkHost = () => {
  const developerSources: DeveloperLike[] = [
    manifest2?.extra?.expoGo?.developer,
    manifest2?.extra?.expoClient?.developer,
    expoConfig?.developer,
    (Constants?.expoGoConfig as { developer?: DeveloperLike } | null | undefined)?.developer,
  ];

  for (const source of developerSources) {
    const candidate = extractDeveloperHost(source);
    if (candidate && !isLoopbackHost(candidate) && !isExpoHosted(candidate)) {
      return candidate;
    }
  }

  const debuggerHost = getDebuggerHost();
  if (debuggerHost && !isLoopbackHost(debuggerHost) && !isExpoHosted(debuggerHost)) {
    return debuggerHost;
  }

  const scriptHost = getScriptUrlHost();
  if (scriptHost && !isLoopbackHost(scriptHost) && !isExpoHosted(scriptHost)) {
    return scriptHost;
  }

  return undefined;
};

const buildHostBaseUrl = (host: string) => {
  const parsedHost = extractHost(host) ?? host;
  return `http://${parsedHost}:8080`;
};


const getBaseURL = () => {
  const explicitBase = getExplicitBaseUrl();
  if (explicitBase) {
    return explicitBase;
  }

  const host = getBundlerHost();

  if (!host || isLoopbackHost(host) || isExpoHosted(host)) {
    const lanHost = getLocalNetworkHost();
    if (lanHost) {
      return buildHostBaseUrl(lanHost);
    }
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
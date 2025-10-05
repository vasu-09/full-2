import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

export default apiClient;
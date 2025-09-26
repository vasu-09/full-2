import axios from 'axios';
import Constants from 'expo-constants';

const getDebuggerHost = () => {
  const expoConfig = Constants.expoConfig ?? Constants.manifest;

  if (!expoConfig) {
    return undefined;
  }

  if (expoConfig.hostUri) {
    return expoConfig.hostUri.split(':')[0];
  }

  if (expoConfig.debuggerHost) {
    return expoConfig.debuggerHost.split(':')[0];
  }

  return undefined;
};

const getBaseURL = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const host = getDebuggerHost();

  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:8080';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'auth.accessToken';
const REFRESH_TOKEN_KEY = 'auth.refreshToken';
const SESSION_ID_KEY = 'auth.sessionId';
const USER_ID_KEY = 'auth.userId';
const ISSUED_AT_KEY = 'auth.issuedAt';

type NullableString = string | null | undefined;

const useSecureStore = Platform.OS !== 'web';

type StorageHandler = {
  setItem: (key: string, value: string) => Promise<void>;
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
};

const secureStoreHandler: StorageHandler = {
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  getItem: (key) => SecureStore.getItemAsync(key),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const asyncStorageHandler: StorageHandler = {
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  getItem: (key) => AsyncStorage.getItem(key),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const storage: StorageHandler = useSecureStore ? secureStoreHandler : asyncStorageHandler;

const setItem = async (key: string, value: NullableString) => {
  if (value === undefined) {
    return;
  }

  if (value === null) {
    await storage.removeItem(key);
    return;
  }

  await storage.setItem(key, value);
};

const getItem = async (key: string) => storage.getItem(key);

export type StoredSession = {
  accessToken: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  userId: string | null;
  issuedAt: string | null;
};

export const saveSession = async ({
  accessToken,
  refreshToken,
  sessionId,
  userId,
  issuedAt,
}: {
  accessToken?: NullableString;
  refreshToken?: NullableString;
  sessionId?: NullableString;
  userId?: NullableString | number;
  issuedAt?: NullableString;
}) => {
  await Promise.all([
    setItem(ACCESS_TOKEN_KEY, accessToken ?? null),
    setItem(REFRESH_TOKEN_KEY, refreshToken ?? null),
    setItem(SESSION_ID_KEY, sessionId ?? null),
    setItem(USER_ID_KEY, userId != null ? String(userId) : null),
    setItem(ISSUED_AT_KEY, issuedAt ?? null),
  ]);
};

export const updateSessionTokens = async ({
  accessToken,
  refreshToken,
  sessionId,
  issuedAt,
}: {
  accessToken?: NullableString;
  refreshToken?: NullableString;
  sessionId?: NullableString;
  issuedAt?: NullableString;
}) => {
  await Promise.all([
    setItem(ACCESS_TOKEN_KEY, accessToken ?? undefined),
    setItem(REFRESH_TOKEN_KEY, refreshToken ?? undefined),
    setItem(SESSION_ID_KEY, sessionId ?? undefined),
    setItem(ISSUED_AT_KEY, issuedAt ?? undefined),
  ]);
};

export const getStoredSession = async (): Promise<StoredSession> => ({
  accessToken: await getItem(ACCESS_TOKEN_KEY),
  refreshToken: await getItem(REFRESH_TOKEN_KEY),
  sessionId: await getItem(SESSION_ID_KEY),
  userId: await getItem(USER_ID_KEY),
  issuedAt: await getItem(ISSUED_AT_KEY),
});

export const getAccessToken = async () => getItem(ACCESS_TOKEN_KEY);

export const getRefreshToken = async () => getItem(REFRESH_TOKEN_KEY);

export const clearSession = async () => {
  await Promise.all([
    storage.removeItem(ACCESS_TOKEN_KEY),
    storage.removeItem(REFRESH_TOKEN_KEY),
    storage.removeItem(SESSION_ID_KEY),
    storage.removeItem(USER_ID_KEY),
    storage.removeItem(ISSUED_AT_KEY),
  ]);
};
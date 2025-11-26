import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Expo SecureStore only accepts alphanumeric characters plus ".", "-" and "_" in keys.
// Colon was causing `Invalid key provided to SecureStore` on native platforms, so
// replace it with a compatible separator. Keep a legacy key for web-only migration.
const STORAGE_KEY = 'e2ee.device-state.v1';
const LEGACY_STORAGE_KEY = 'e2ee:device-state:v1';

type StorageHandler = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
};

const normalizeSecureStoreKey = (key: string) => {
  const trimmed = key.trim();
  const normalized = trimmed.replace(/[^A-Za-z0-9._-]/g, '_');

  if (!normalized) {
    throw new Error('Invalid SecureStore key: key is empty after normalization');
  }

  return normalized;
};

const secureHandler: StorageHandler = {
  get: (key) => SecureStore.getItemAsync(normalizeSecureStoreKey(key)),
  set: (key, value) => SecureStore.setItemAsync(normalizeSecureStoreKey(key), value),
};

const asyncHandler: StorageHandler = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
};

const storage: StorageHandler = Platform.OS === 'web' ? asyncHandler : secureHandler;

export type StoredPrekey = {
  publicKey: string;
  privateKey: string;
  uploaded: boolean;
  consumed?: boolean;
  createdAt: number;
};

export type SentMessageKey = {
  messageId: string;
  key: string;
  createdAt: number;
};

export type DeviceState = {
  version: number;
  deviceId: string;
  identity: {
    publicKey: string;
    privateKey: string;
  };
  signedPrekey: {
    publicKey: string;
    privateKey: string;
    signature: string | null;
  };
  oneTimePrekeys: StoredPrekey[];
  sentMessageKeys: SentMessageKey[];
  lastRegisteredAt?: number;
};

export const loadDeviceState = async (): Promise<DeviceState | null> => {
  const safeGet = async (key: string) => {
    try {
      return await storage.get(key);
    } catch {
      return null;
    }
    };

  // Read from the new key first; fall back to legacy key on web (AsyncStorage) only.
  const rawFromNewKey = await safeGet(STORAGE_KEY);
  const raw = rawFromNewKey ?? (Platform.OS === 'web' ? await asyncHandler.get(LEGACY_STORAGE_KEY) : null);

  if (!raw) {
    return null;
  }

  if (!rawFromNewKey && Platform.OS === 'web') {
    // Migrate legacy value to the new key for future reads.
    await storage.set(STORAGE_KEY, raw);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed as DeviceState;
  } catch {
    return null;
  }
};

export const saveDeviceState = async (state: DeviceState): Promise<void> => {
  const payload = JSON.stringify(state);
  await storage.set(STORAGE_KEY, payload);
};

export const updateDeviceState = async (updater: (current: DeviceState | null) => DeviceState): Promise<DeviceState> => {
  const current = await loadDeviceState();
  const next = updater(current);
  await saveDeviceState(next);
  return next;
};

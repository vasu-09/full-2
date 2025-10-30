import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEY = 'e2ee:device-state:v1';

type StorageHandler = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
};

const secureHandler: StorageHandler = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
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
  try {
    const raw = await storage.get(STORAGE_KEY);
    if (!raw) {
      return null;
    }
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import nacl from 'tweetnacl';

import {
    base64ToBytes,
    bytesToBase64,
    bytesToUtf8,
    hexToBytes,
    utf8ToBytes,
} from './e2ee/encoding';
import { createIntegrityStorage, normalizeSecureStoreKey, type StorageHandler } from './secureStorage';

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  aad?: string;
};

const SHARED_KEY_PREFIX = 'chat.sharedKey:';

const sharedKeyStorage: StorageHandler = Platform.OS === 'web'
  ? {
      getItem: key => AsyncStorage.getItem(key),
      setItem: (key, value) => AsyncStorage.setItem(key, value),
      removeItem: key => AsyncStorage.removeItem(key),
    }
  : createIntegrityStorage(
      {
        getItem: key => SecureStore.getItemAsync(key),
        setItem: (key, value) => SecureStore.setItemAsync(key, value),
        deleteItem: key => SecureStore.deleteItemAsync(key),
      },
      { normalizeKey: normalizeSecureStoreKey },
    );

const getStorageKey = (roomKey: string) => `${SHARED_KEY_PREFIX}${normalizeSecureStoreKey(roomKey)}`;

const deriveSharedKey = async (roomKey: string): Promise<string> => {
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, roomKey);
  const keyBytes = hexToBytes(hex).slice(0, nacl.secretbox.keyLength);
  return bytesToBase64(keyBytes);
};

export const ensureSharedRoomKey = async (roomKey: string): Promise<string> => {
  const storageKey = getStorageKey(roomKey);
  const existing = await sharedKeyStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }
  const derived = await deriveSharedKey(roomKey);
  await sharedKeyStorage.setItem(storageKey, derived);
  return derived;
};

export const decryptMessage = async (
  payload: EncryptedPayload,
  sharedKeyB64: string,
): Promise<string> => {
  try {
    const key = base64ToBytes(sharedKeyB64);
    if (key.length !== nacl.secretbox.keyLength) {
      throw new Error('Invalid key length');
    }
    const iv = base64ToBytes(payload.iv);
    if (iv.length !== nacl.secretbox.nonceLength) {
      throw new Error('Invalid nonce length');
    }
    const cipher = base64ToBytes(payload.ciphertext);
    const opened = nacl.secretbox.open(cipher, iv, key);
    if (!opened) {
      throw new Error('Unable to authenticate ciphertext');
    }
    return bytesToUtf8(opened);
  } catch (err) {
    console.warn('[crypto] failed to decrypt message', err);
    throw err;
  }
};

export const encryptMessage = async (
  plaintext: string,
  sharedKeyB64: string,
): Promise<EncryptedPayload> => {
  const key = base64ToBytes(sharedKeyB64);
  if (key.length !== nacl.secretbox.keyLength) {
    throw new Error('Invalid key length');
  }
  const iv = nacl.randomBytes(nacl.secretbox.nonceLength);
  const cipher = nacl.secretbox(utf8ToBytes(plaintext), iv, key);
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(cipher),
  };
};
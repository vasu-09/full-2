// app/services/e2ee/ed25519.ts

import { getPublicKey, sign as nobleSign } from '@noble/ed25519';
import * as Random from 'expo-random';

export type Ed25519KeyPair = {
  privateKey: Uint8Array; // 32 bytes
  publicKey: Uint8Array;  // 32 bytes
};

/**
 * Generate a new Ed25519 keypair using expo-random for entropy.
 */
export const generateKeyPair = async (): Promise<Ed25519KeyPair> => {
  // 32 random bytes for private key
  const privBytes = Random.getRandomBytes(32);
  const privateKey = new Uint8Array(privBytes);

  if (privateKey.length !== 32) {
    throw new Error(`Ed25519 private key must be 32 bytes, got ${privateKey.length}`);
  }

  const publicKey = await getPublicKey(privateKey); // 32-byte public key

  return { privateKey, publicKey };
};

/**
 * Derive public key from an existing 32-byte private key.
 */
export const getPublicKeyFromPrivate = async (
  privateKey: Uint8Array
): Promise<Uint8Array> => {
  if (privateKey.length !== 32) {
    throw new Error(`Ed25519 private key must be 32 bytes, got ${privateKey.length}`);
  }
  return getPublicKey(privateKey);
};

/**
 * Sign a message with Ed25519.
 * message: raw bytes to sign (your server should verify exactly the same bytes).
 */
export const sign = async (
  message: Uint8Array,
  privateKey: Uint8Array
): Promise<Uint8Array> => {
  if (privateKey.length !== 32) {
    throw new Error(`Ed25519 private key must be 32 bytes, got ${privateKey.length}`);
  }

  const signature = await nobleSign(message, privateKey); // 64-byte signature
  return signature;
};

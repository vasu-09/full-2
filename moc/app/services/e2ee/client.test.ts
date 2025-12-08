import { claimPrekey, getPrekeyStock, listDeviceBundles, uploadPrekeys } from './api';
import { E2EEClient } from './client';
import { generateDhKeyPair } from './dh';
import { generateKeyPair as generateEd25519KeyPair, sign as signEd25519 } from './ed25519';
import { base64ToBytes, bytesToBase64 } from './encoding';
import type { DeviceState } from './storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock('./api', () => ({
  claimPrekey: jest.fn(),
  listDeviceBundles: jest.fn(),
  registerDevice: jest.fn(),
  uploadPrekeys: jest.fn(),
  getPrekeyStock: jest.fn(),
}));

jest.mock('./storage', () => {
  const actual = jest.requireActual('./storage');
  return {
    ...actual,
    loadDeviceState: jest.fn(async () => null),
    saveDeviceState: jest.fn(async () => {}),
  };
});

jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');
  return {
    getRandomBytes: (length: number) => nodeCrypto.randomBytes(length),
    digestStringAsync: async (_algorithm: string, value: string) =>
      nodeCrypto.createHash('sha512').update(value).digest('hex'),
    CryptoDigestAlgorithm: { SHA512: 'SHA-512' },
  };
});

const mockClaimPrekey = claimPrekey as jest.MockedFunction<typeof claimPrekey>;
const mockListDeviceBundles = listDeviceBundles as jest.MockedFunction<typeof listDeviceBundles>;
const mockGetPrekeyStock = getPrekeyStock as jest.MockedFunction<typeof getPrekeyStock>;
const mockUploadPrekeys = uploadPrekeys as jest.MockedFunction<typeof uploadPrekeys>;

const buildSenderState = (): DeviceState => {
  const identity = generateEd25519KeyPair();
  const signedPrekey = generateDhKeyPair();

  return {
    version: 15,
    deviceId: 'sender-dev',
    identity: {
      publicKey: bytesToBase64(identity.publicKey),
      privateKey: bytesToBase64(identity.privateKey),
    },
    signedPrekey: {
      publicKey: signedPrekey.publicKey,
      privateKey: signedPrekey.privateKey,
      signature: null,
    },
    oneTimePrekeys: [],
    sentMessageKeys: [],
    peerFingerprints: {},
  };
};

const signPrekey = (identityPriv: Uint8Array, prekeyPub: string) =>
  bytesToBase64(signEd25519(base64ToBytes(prekeyPub), identityPriv));

const buildRecipientState = (
  deviceId: string,
  identity: ReturnType<typeof generateEd25519KeyPair>,
  signedPrekey: ReturnType<typeof generateDhKeyPair>,
  signature: string,
  otk: ReturnType<typeof generateDhKeyPair>
): DeviceState => ({
  version: 15,
  deviceId,
  identity: {
    publicKey: bytesToBase64(identity.publicKey),
    privateKey: bytesToBase64(identity.privateKey),
  },
  signedPrekey: {
    publicKey: signedPrekey.publicKey,
    privateKey: signedPrekey.privateKey,
    signature,
  },
  oneTimePrekeys: [
    {
      publicKey: otk.publicKey,
      privateKey: otk.privateKey,
      uploaded: true,
      createdAt: Date.now(),
    },
  ],
  sentMessageKeys: [],
  peerFingerprints: {},
});

describe('E2EEClient device fingerprint handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPrekeyStock.mockResolvedValue(10);
    mockUploadPrekeys.mockResolvedValue();
  });

  it('refreshes sessions when the recipient reinstalls with new keys', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const targetUserId = 42;
    const recipientDeviceId = 'recipient-dev';

    const v1Identity = generateEd25519KeyPair();
    const v1SignedPrekey = generateDhKeyPair();
    const v1Otk = generateDhKeyPair();
    const v1Signature = signPrekey(v1Identity.privateKey, v1SignedPrekey.publicKey);

    const v2Identity = generateEd25519KeyPair();
    const v2SignedPrekey = generateDhKeyPair();
    const v2Otk = generateDhKeyPair();
    const v2Signature = signPrekey(v2Identity.privateKey, v2SignedPrekey.publicKey);

    mockListDeviceBundles
      .mockResolvedValueOnce([
        {
          deviceId: recipientDeviceId,
          identityKeyPub: bytesToBase64(v1Identity.publicKey),
          signedPrekeyPub: v1SignedPrekey.publicKey,
          signedPrekeySig: v1Signature,
          oneTimePrekeyPub: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          deviceId: recipientDeviceId,
          identityKeyPub: bytesToBase64(v2Identity.publicKey),
          signedPrekeyPub: v2SignedPrekey.publicKey,
          signedPrekeySig: v2Signature,
          oneTimePrekeyPub: null,
        },
      ]);

    mockClaimPrekey
      .mockResolvedValueOnce({
        deviceId: recipientDeviceId,
        identityKeyPub: bytesToBase64(v1Identity.publicKey),
        signedPrekeyPub: v1SignedPrekey.publicKey,
        signedPrekeySig: v1Signature,
        oneTimePrekeyPub: v1Otk.publicKey,
      })
      .mockResolvedValueOnce({
        deviceId: recipientDeviceId,
        identityKeyPub: bytesToBase64(v2Identity.publicKey),
        signedPrekeyPub: v2SignedPrekey.publicKey,
        signedPrekeySig: v2Signature,
        oneTimePrekeyPub: v2Otk.publicKey,
      });

    const sender = new E2EEClient(buildSenderState());

    const recipientV1 = new E2EEClient(
      buildRecipientState(recipientDeviceId, v1Identity, v1SignedPrekey, v1Signature, v1Otk)
    );
    const recipientV2 = new E2EEClient(
      buildRecipientState(recipientDeviceId, v2Identity, v2SignedPrekey, v2Signature, v2Otk)
    );

    const first = await sender.encryptForUser(targetUserId, 'm1', 'hello-old-device');
    expect(first).not.toBeNull();

    const firstPlaintext = await recipientV1.decryptEnvelope(
      {
        ...first!.envelope,
        messageId: 'm1',
      },
      false
    );
    expect(firstPlaintext).toBe('hello-old-device');

    const second = await sender.encryptForUser(targetUserId, 'm2', 'hello-new-device');
    expect(second).not.toBeNull();

    const secondPlaintext = await recipientV2.decryptEnvelope(
      {
        ...second!.envelope,
        messageId: 'm2',
      },
      false
    );
    expect(secondPlaintext).toBe('hello-new-device');

    const cached = (sender as unknown as { state: DeviceState }).state.peerFingerprints?.[targetUserId];
    expect(cached?.identityKey).toBe(bytesToBase64(v2Identity.publicKey));
    expect(first!.sharedKey).not.toEqual(second!.sharedKey);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
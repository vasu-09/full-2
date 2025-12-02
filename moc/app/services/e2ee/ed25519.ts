import { randomBytes } from './random';
import { sha512 } from './sha512';

const bytes = (len: number) => new Uint8Array(len);
const toBigLE = (input: Uint8Array): bigint => {
  let value = 0n;
  for (let i = input.length - 1; i >= 0; i -= 1) {
    value = (value << 8n) + BigInt(input[i]);
  }
  return value;
};
const fromBigLE = (num: bigint, len: number): Uint8Array => {
  const out = bytes(len);
  let current = num;
  for (let i = 0; i < len; i += 1) {
    out[i] = Number(current & 0xffn);
    current >>= 8n;
  }
  return out;
};

const mod = (a: bigint, b: bigint) => {
  const res = a % b;
  return res >= 0n ? res : b + res;
};

const modPow = (a: bigint, e: bigint, m: bigint): bigint => {
  let res = 1n;
  let x = mod(a, m);
  let exp = e;
  while (exp > 0n) {
    if (exp & 1n) res = mod(res * x, m);
    x = mod(x * x, m);
    exp >>= 1n;
  }
  return res;
};

// ed25519 domain parameters
const P = (1n << 255n) - 19n;
const L = 0x10000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3edn;
const d = -121665n * modPow(121666n, P - 2n, P) % P;
const I = modPow(2n, (P - 1n) / 4n, P);

const uvRatio = (u: bigint, v: bigint): bigint | null => {
  const v3 = mod(v * v * v, P);
  const u2v3 = mod(u * u * v3, P);
  const x = mod(u2v3 * modPow(u2v3, (P - 5n) / 8n, P), P);
  const vx2 = mod(v * x * x, P);
  const root = mod(vx2, P) === mod(u, P) ? x : mod(x * I, P);
  const check = mod(root * root * v, P);
  return check === mod(u, P) ? root : null;
};

const invert = (x: bigint) => modPow(x, P - 2n, P);

type Point = { x: bigint; y: bigint; z: bigint; t: bigint };

const BASE: Point = {
  x: 15112221349535400772501151409588531511454012693041857206046113283949847762202n,
  y: 46316835694926478169428394003475163141307993866256225615783033603165251855960n,
  z: 1n,
  t: 0n,
};
BASE.t = mod(BASE.x * BASE.y, P);

const pointAdd = (a: Point, b: Point): Point => {
  const A = mod((a.y - a.x) * (b.y - b.x), P);
  const B = mod((a.y + a.x) * (b.y + b.x), P);
  const C = mod(2n * a.t * b.t * d, P);
  const D = mod(2n * a.z * b.z, P);
  const E = B - A;
  const F = D - C;
  const G = D + C;
  const H = B + A;
  return {
    x: mod(E * F, P),
    y: mod(G * H, P),
    z: mod(F * G, P),
    t: mod(E * H, P),
  };
};

const pointDouble = (p: Point): Point => pointAdd(p, p);

const wNAF = (scalar: bigint, point: Point): Point => {
  let n = scalar;
  let Q: Point = { x: 0n, y: 1n, z: 1n, t: 0n };
  let Ptemp = point;
  while (n > 0n) {
    if (n & 1n) Q = pointAdd(Q, Ptemp);
    Ptemp = pointDouble(Ptemp);
    n >>= 1n;
  }
  return Q;
};

const ed25519Clamp = (hash: Uint8Array): Uint8Array => {
  const clamped = new Uint8Array(hash.slice(0, 32));
  clamped[0] &= 248;
  clamped[31] &= 63;
  clamped[31] |= 64;
  return clamped;
};

const encodePoint = (p: Point): Uint8Array => {
  const zInv = invert(p.z);
  const x = mod(p.x * zInv, P);
  const y = mod(p.y * zInv, P);
  const bytesOut = fromBigLE(y, 32);
  bytesOut[31] |= Number((x & 1n) << 7n);
  return bytesOut;
};

const scalarModL = (scalar: Uint8Array): bigint => mod(toBigLE(scalar), L);

export type Ed25519KeyPair = { publicKey: Uint8Array; privateKey: Uint8Array };

export const randomPrivateKey = (): Uint8Array => randomBytes(32);

export const getPublicKey = (privateKey: Uint8Array): Uint8Array => {
  if (privateKey.length !== 32) throw new Error('Private key must be 32 bytes');
  const hashed = sha512(privateKey);
  const s = ed25519Clamp(hashed);
  const scalar = scalarModL(s);
  const P = wNAF(scalar, BASE);
  return encodePoint(P);
};

export const sign = (message: Uint8Array, privateKey: Uint8Array): Uint8Array => {
  if (privateKey.length !== 32) throw new Error('Private key must be 32 bytes');
  const hashed = sha512(privateKey);
  const s = ed25519Clamp(hashed);
  const prefix = hashed.slice(32);
  const r = scalarModL(sha512(new Uint8Array([...prefix, ...message])));
  const R = encodePoint(wNAF(r, BASE));
  const k = scalarModL(sha512(new Uint8Array([...R, ...getPublicKey(privateKey), ...message])));
  const sScalar = (r + k * scalarModL(s)) % L;
  const sig = bytes(64);
  sig.set(R, 0);
  sig.set(fromBigLE(sScalar, 32), 32);
  return sig;
};

export const generateKeyPair = (): Ed25519KeyPair => {
  const privateKey = randomPrivateKey();
  const publicKey = getPublicKey(privateKey);
  return { publicKey, privateKey };
};
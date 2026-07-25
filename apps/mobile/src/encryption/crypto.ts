import { gcm } from '@noble/ciphers/aes';
import { scryptAsync } from '@noble/hashes/scrypt';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import * as Crypto from 'expo-crypto';

const envelopePrefix = 'homeapp:v1';
const scryptOptions = {
  N: 2 ** 15,
  asyncTick: 8,
  dkLen: 32,
  maxmem: 64 * 1024 * 1024,
  p: 1,
  r: 8
} as const;

export async function randomKey(): Promise<Uint8Array> {
  return Crypto.getRandomBytesAsync(32);
}

export async function randomSalt(): Promise<Uint8Array> {
  return Crypto.getRandomBytesAsync(16);
}

export async function derivePassphraseKey(
  passphrase: string,
  saltHex: string
): Promise<Uint8Array> {
  if (passphrase.length < 12) {
    throw new Error('Hasło szyfrowania musi mieć co najmniej 12 znaków.');
  }

  return scryptAsync(utf8ToBytes(passphrase), hexToBytes(saltHex), scryptOptions);
}

export async function sealBytes(
  value: Uint8Array,
  key: Uint8Array,
  context: string
): Promise<string> {
  const nonce = await Crypto.getRandomBytesAsync(12);
  const ciphertext = gcm(key, nonce, utf8ToBytes(context)).encrypt(value);

  return `${envelopePrefix}:${bytesToHex(nonce)}:${bytesToHex(ciphertext)}`;
}

export function openBytes(envelope: string, key: Uint8Array, context: string): Uint8Array {
  const [prefix, version, nonceHex, ciphertextHex] = envelope.split(':');

  if (`${prefix}:${version}` !== envelopePrefix || !nonceHex || !ciphertextHex) {
    throw new Error('Nieprawidłowy format zaszyfrowanych danych.');
  }

  try {
    return gcm(key, hexToBytes(nonceHex), utf8ToBytes(context)).decrypt(hexToBytes(ciphertextHex));
  } catch {
    throw new Error('Nieprawidłowy klucz szyfrowania albo uszkodzone dane.');
  }
}

export async function sealJson<T>(value: T, key: Uint8Array, context: string): Promise<string> {
  return sealBytes(utf8ToBytes(JSON.stringify(value)), key, context);
}

export function openJson<T>(envelope: string, key: Uint8Array, context: string): T {
  try {
    return JSON.parse(bytesToUtf8(openBytes(envelope, key, context))) as T;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Nieprawidłowy')) {
      throw error;
    }

    throw new Error('Nie udało się odczytać zaszyfrowanych danych.');
  }
}

export function keyToHex(key: Uint8Array): string {
  return bytesToHex(key);
}

export function keyFromHex(value: string): Uint8Array {
  const key = hexToBytes(value);

  if (key.length !== 32) {
    throw new Error('Nieprawidłowa długość klucza.');
  }

  return key;
}

export function formatRecoveryCode(key: Uint8Array): string {
  return (
    bytesToHex(key)
      .match(/.{1,4}/g)
      ?.join('-') ?? bytesToHex(key)
  );
}

export function parseRecoveryCode(value: string): Uint8Array {
  return keyFromHex(value.replace(/[^a-fA-F0-9]/g, '').toLowerCase());
}

import { gcm } from '@noble/ciphers/aes';
import { scryptAsync } from '@noble/hashes/scrypt';
import { bytesToHex, hexToBytes, bytesToUtf8, utf8ToBytes } from '@noble/hashes/utils';

const envelopePrefix = 'homeapp:v1';
const scryptOptions = { N: 2 ** 15, asyncTick: 8, dkLen: 32, maxmem: 64 * 1024 * 1024, p: 1, r: 8 } as const;

function randomBytes(length: number) {
  const value = new Uint8Array(length);
  crypto.getRandomValues(value);
  return value;
}

export async function randomKey() { return randomBytes(32); }
export async function randomSalt() { return randomBytes(16); }

export async function derivePassphraseKey(passphrase: string, saltHex: string) {
  if (passphrase.length < 12) throw new Error('Hasło szyfrowania musi mieć co najmniej 12 znaków.');
  return scryptAsync(utf8ToBytes(passphrase), hexToBytes(saltHex), scryptOptions);
}

export async function sealBytes(value: Uint8Array, key: Uint8Array, context: string) {
  const nonce = randomBytes(12);
  const ciphertext = gcm(key, nonce, utf8ToBytes(context)).encrypt(value);
  return `${envelopePrefix}:${bytesToHex(nonce)}:${bytesToHex(ciphertext)}`;
}

export function openBytes(envelope: string, key: Uint8Array, context: string) {
  const [prefix, version, nonceHex, ciphertextHex] = envelope.split(':');
  if (`${prefix}:${version}` !== envelopePrefix || !nonceHex || !ciphertextHex) throw new Error('Nieprawidłowy format zaszyfrowanych danych.');
  try { return gcm(key, hexToBytes(nonceHex), utf8ToBytes(context)).decrypt(hexToBytes(ciphertextHex)); }
  catch { throw new Error('Nieprawidłowy klucz szyfrowania albo uszkodzone dane.'); }
}

export async function sealJson<T>(value: T, key: Uint8Array, context: string) { return sealBytes(utf8ToBytes(JSON.stringify(value)), key, context); }
export function openJson<T>(envelope: string, key: Uint8Array, context: string): T {
  try { return JSON.parse(bytesToUtf8(openBytes(envelope, key, context))) as T; }
  catch (error) { if (error instanceof Error && error.message.startsWith('Nieprawidłowy')) throw error; throw new Error('Nie udało się odczytać zaszyfrowanych danych.'); }
}

export function keyToHex(key: Uint8Array) { return bytesToHex(key); }
export function keyFromHex(value: string) {
  const key = hexToBytes(value);
  if (key.length !== 32) throw new Error('Nieprawidłowa długość klucza.');
  return key;
}
export function formatRecoveryCode(key: Uint8Array) { return bytesToHex(key).match(/.{1,4}/g)?.join('-') ?? bytesToHex(key); }
export function parseRecoveryCode(value: string) { return keyFromHex(value.replace(/[^a-fA-F0-9]/g, '').toLowerCase()); }

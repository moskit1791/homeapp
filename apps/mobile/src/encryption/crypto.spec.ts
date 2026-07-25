import {
  derivePassphraseKey,
  formatRecoveryCode,
  keyToHex,
  openJson,
  parseRecoveryCode,
  sealJson
} from './crypto';

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (length: number) =>
    Uint8Array.from({ length }, (_, index) => (index * 17 + 11) % 256)
}));

describe('client-side encryption', () => {
  it('round-trips an authenticated JSON envelope and rejects a wrong key', async () => {
    const key = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
    const envelope = await sealJson(
      { amount: 123.45, note: 'poufne' },
      key,
      'homeapp:finances:expense'
    );

    expect(openJson(envelope, key, 'homeapp:finances:expense')).toEqual({
      amount: 123.45,
      note: 'poufne'
    });
    expect(() =>
      openJson(
        envelope,
        Uint8Array.from({ length: 32 }, () => 9),
        'homeapp:finances:expense'
      )
    ).toThrow();
  });

  it('derives a stable passphrase key and round-trips a recovery code', async () => {
    const saltHex = keyToHex(Uint8Array.from({ length: 16 }, (_, index) => index));
    const first = await derivePassphraseKey('bardzo-dlugie-haslo', saltHex);
    const second = await derivePassphraseKey('bardzo-dlugie-haslo', saltHex);
    const recoveryKey = Uint8Array.from({ length: 32 }, (_, index) => 255 - index);

    expect(first).toEqual(second);
    expect(parseRecoveryCode(formatRecoveryCode(recoveryKey))).toEqual(recoveryKey);
  });
});

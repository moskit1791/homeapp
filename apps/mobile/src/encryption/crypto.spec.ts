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

  it('keeps old expense envelopes readable and extended envelopes compatible with old decoders', async () => {
    const key = Uint8Array.from({ length: 32 }, (_, index) => 255 - index);
    const aad = 'homeapp:finances:expense';
    const oldEnvelope =
      'homeapp:v1:0b1c2d3e4f60718293a4b5c6:4546f7b5df056806ff2a94539050fbf55de596d1a6bdc48ad0ba92ad050bc9a9';
    const extendedEnvelope = await sealJson(
      {
        amount: 42.5,
        name: 'Zakupy',
        occurredAt: '2026-07-26T08:00:00.000Z',
        originalAmount: 10,
        originalCurrency: 'EUR',
        source: 'bank_notification'
      },
      key,
      aad
    );

    expect(openJson(oldEnvelope, key, aad)).toEqual({ amount: 19.99 });
    expect((openJson(extendedEnvelope, key, aad) as { amount: number }).amount).toBe(42.5);
  });
});

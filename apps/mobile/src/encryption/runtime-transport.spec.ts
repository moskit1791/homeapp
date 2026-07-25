import { openJson, sealJson } from './crypto';
import {
  EncryptedPayloadIntegrityError,
  configureRuntimeEncryption,
  prepareEncryptedApiBody,
  transformEncryptedApiResponse
} from './runtime-transport';

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (length: number) =>
    Uint8Array.from({ length }, (_, index) => (index * 19 + 7) % 256)
}));

const key = Uint8Array.from({ length: 32 }, (_, index) => index + 3);

describe('encrypted API transport', () => {
  afterEach(() => {
    configureRuntimeEncryption({ dataKey: null, enabledModules: [], keyVersion: null });
  });

  it('encrypts a todo write and decrypts the returned record locally', async () => {
    configureRuntimeEncryption({ dataKey: key, enabledModules: ['todo'], keyVersion: 4 });

    const request = (await prepareEncryptedApiBody('/todo-items', 'POST', {
      description: 'Tylko dla rodziny',
      scopeType: 'household',
      title: 'Prywatne zadanie'
    })) as {
      description: string;
      encryptedPayload: string;
      encryptionVersion: number;
      scopeType: string;
      title: string;
    };

    expect(request.title).toBe('[Zaszyfrowane zadanie]');
    expect(request.description).toBe('');
    expect(request.encryptionVersion).toBe(4);
    expect(
      openJson(request.encryptedPayload, key, 'homeapp:todo:todo-item')
    ).toEqual({ description: 'Tylko dla rodziny', title: 'Prywatne zadanie' });

    const response = transformEncryptedApiResponse({
      ...request,
      encryptionEntity: 'todo-item',
      id: 'todo-1'
    });

    expect(response.title).toBe('Prywatne zadanie');
    expect(response.description).toBe('Tylko dla rodziny');
  });

  it('merges a partial encrypted update with fields cached from the decrypted record', async () => {
    configureRuntimeEncryption({ dataKey: key, enabledModules: ['shopping'], keyVersion: 2 });
    const initialEnvelope = await sealJson(
      {
        category: 'Nabiał',
        expirationDate: '2026-07-24',
        name: 'Mleko',
        quantity: '1'
      },
      key,
      'homeapp:shopping:shopping-item'
    );

    transformEncryptedApiResponse({
      encryptedPayload: initialEnvelope,
      encryptionEntity: 'shopping-item',
      id: 'shopping-1'
    });

    const request = (await prepareEncryptedApiBody(
      '/shopping-lists/items/shopping-1',
      'PATCH',
      { quantity: '2' }
    )) as { encryptedPayload: string; quantity: string };

    expect(
      openJson(request.encryptedPayload, key, 'homeapp:shopping:shopping-item')
    ).toEqual({
      category: 'Nabiał',
      expirationDate: '2026-07-24',
      name: 'Mleko',
      quantity: '2'
    });
  });

  it('allows a confirmed AI request without encrypting the prompt body', async () => {
    configureRuntimeEncryption({
      dataKey: key,
      enabledModules: ['meal_planner', 'shopping'],
      keyVersion: 3
    });

    await expect(
      prepareEncryptedApiBody('/meal-plans/ai/chat', 'POST', {
        messages: [{ content: 'Ułóż plan z moich danych', role: 'user' }]
      })
    ).resolves.toEqual({
      messages: [{ content: 'Ułóż plan z moich danych', role: 'user' }]
    });
    await expect(
      prepareEncryptedApiBody('/shopping-lists/daily/items/ai-import', 'POST', {
        message: 'mleko i leki'
      })
    ).resolves.toEqual({ message: 'mleko i leki' });
  });

  it.each([
    {
      body: { title: 'Nowy pomysł' },
      context: 'homeapp:meal_planner:meal-idea',
      entity: 'meal-idea',
      module: 'meal_planner' as const,
      path: '/meal-ideas/idea-1'
    },
    {
      body: { name: 'Nowy koszt' },
      context: 'homeapp:annual_costs:annual-cost',
      entity: 'annual-cost',
      module: 'annual_costs' as const,
      path: '/annual-costs/cost-1'
    },
    {
      body: { title: 'Nowy wpis' },
      context: 'homeapp:data_entries:data-entry',
      entity: 'data-entry',
      module: 'data_entries' as const,
      path: '/data-entries/entry-1'
    }
  ])('encrypts protected fields when editing $entity', async ({ body, context, module, path }) => {
    configureRuntimeEncryption({ dataKey: key, enabledModules: [module], keyVersion: 5 });

    const request = (await prepareEncryptedApiBody(path, 'PATCH', body)) as unknown as {
      encryptedPayload: string;
      encryptionVersion: number;
    };

    expect(request.encryptionVersion).toBe(5);
    expect(openJson(request.encryptedPayload, key, context)).toMatchObject(body);
  });

  it('reports ciphertext integrity failures instead of silently returning placeholders', () => {
    configureRuntimeEncryption({ dataKey: key, enabledModules: ['todo'], keyVersion: 4 });

    expect(() =>
      transformEncryptedApiResponse({
        encryptedPayload: 'homeapp:v1:00:00',
        encryptionEntity: 'todo-item',
        id: 'todo-corrupted'
      })
    ).toThrow(EncryptedPayloadIntegrityError);
  });
});

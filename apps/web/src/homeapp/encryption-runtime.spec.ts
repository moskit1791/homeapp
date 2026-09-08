import { it, expect, describe, afterEach } from 'vitest';

import { openJson, sealJson } from './encryption-crypto';
import {
  prepareEncryptedApiBody,
  configureRuntimeEncryption,
  transformEncryptedApiResponse,
} from './encryption-runtime';

const key = Uint8Array.from({ length: 32 }, (_, index) => index + 3);

describe('web encryption transport', () => {
  afterEach(() => {
    configureRuntimeEncryption({ dataKey: null, enabledModules: [], keyVersion: null });
  });

  it('encrypts todo writes and decrypts API records', async () => {
    configureRuntimeEncryption({ dataKey: key, enabledModules: ['todo'], keyVersion: 4 });
    const request = await prepareEncryptedApiBody('/todo-items', 'POST', {
      description: 'Tylko dla rodziny',
      scopeType: 'household',
      title: 'Prywatne zadanie',
    });

    expect(request.title).toBe('[Zaszyfrowane zadanie]');
    expect(request.encryptionVersion).toBe(4);
    expect(openJson(request.encryptedPayload, key, 'homeapp:todo:todo-item')).toEqual({
      description: 'Tylko dla rodziny',
      title: 'Prywatne zadanie',
    });

    const response = transformEncryptedApiResponse({
      ...request,
      encryptionEntity: 'todo-item',
      id: 'todo-1',
    });
    expect(response.title).toBe('Prywatne zadanie');
  });

  it('preserves cached private fields during partial updates', async () => {
    configureRuntimeEncryption({ dataKey: key, enabledModules: ['shopping'], keyVersion: 2 });
    const encryptedPayload = await sealJson(
      { category: 'Nabiał', expirationDate: null, name: 'Mleko', quantity: '1' },
      key,
      'homeapp:shopping:shopping-item'
    );
    transformEncryptedApiResponse({ encryptedPayload, encryptionEntity: 'shopping-item', id: 'item-1' });

    const request = await prepareEncryptedApiBody('/shopping-lists/items/item-1', 'PATCH', {
      quantity: '2',
    });
    expect(openJson(request.encryptedPayload, key, 'homeapp:shopping:shopping-item')).toEqual({
      category: 'Nabiał',
      expirationDate: null,
      name: 'Mleko',
      quantity: '2',
    });
  });

  it('encrypts finance and calendar private fields', async () => {
    configureRuntimeEncryption({ dataKey: key, enabledModules: ['finances', 'calendar'], keyVersion: 7 });
    const expense = await prepareEncryptedApiBody('/finance/expenses', 'POST', {
      amount: 42,
      budgetItemId: 'budget-1',
      name: 'Apteka',
    });
    const event = await prepareEncryptedApiBody('/calendar/events', 'POST', {
      eventDate: '2026-09-08',
      title: 'Lekarz',
    });

    expect(expense.amount).toBe(0);
    expect(openJson(expense.encryptedPayload, key, 'homeapp:finances:expense')).toMatchObject({ amount: 42, name: 'Apteka' });
    expect(event.title).toBe('[Zaszyfrowane wydarzenie]');
    expect(openJson(event.encryptedPayload, key, 'homeapp:calendar:calendar-event')).toMatchObject({ title: 'Lekarz' });
  });
});

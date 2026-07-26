import { describe, expect, it, vi } from 'vitest';
import { ExpensesService } from './expenses.service';

function queryResult(rows: unknown[] = []) {
  return { rowCount: rows.length, rows };
}

function expenseRow(overrides: Record<string, unknown> = {}) {
  return {
    amount: '24.50',
    budget_item_id: 'budget-item-id',
    created_at: '2026-07-26T08:00:00.000Z',
    encrypted_payload: null,
    encryption_version: null,
    id: 'expense-id',
    name: 'Zakupy',
    occurred_at: null,
    original_amount: null,
    original_currency: null,
    source: 'manual',
    source_external_id: null,
    updated_at: '2026-07-26T08:00:00.000Z',
    ...overrides
  };
}

function createRealtime() {
  return { publish: vi.fn() };
}

describe('ExpensesService', () => {
  it('keeps the manual expense contract and persists the optional display name', async () => {
    const database = {
      query: vi
        .fn()
        .mockResolvedValueOnce(queryResult([{ id: 'budget-item-id' }]))
        .mockResolvedValueOnce(queryResult([expenseRow()]))
    };
    const realtime = createRealtime();
    const service = new ExpensesService(database as never, realtime as never);

    await expect(
      service.createExpense('household-id', {
        amount: 24.5,
        budgetItemId: 'budget-item-id',
        name: '  Zakupy  '
      })
    ).resolves.toMatchObject({
      amount: '24.50',
      name: 'Zakupy',
      source: 'manual'
    });

    expect(database.query.mock.calls[1]?.[1]).toEqual([
      'household-id',
      'budget-item-id',
      24.5,
      'Zakupy',
      null,
      null
    ]);
    expect(realtime.publish).toHaveBeenCalledWith('household-id', 'finance.changed', 'expense-id');
  });

  it('returns created, duplicate and failed results independently in one import batch', async () => {
    const duplicate = expenseRow({
      id: 'existing-expense-id',
      name: 'Bilet',
      occurred_at: '2026-07-25T18:30:00.000Z',
      original_amount: '5.50',
      original_currency: 'EUR',
      source: 'bank_notification',
      source_external_id: 'source-existing'
    });
    const created = expenseRow({
      id: 'created-expense-id',
      name: 'Sklep',
      occurred_at: '2026-07-26T07:30:00.000Z',
      original_amount: '24.50',
      original_currency: 'PLN',
      source: 'bank_notification',
      source_external_id: 'source-new'
    });
    const client = {
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        if (sql.includes('from budget_items bi')) {
          return values?.[1] === 'deleted-budget-item'
            ? queryResult()
            : queryResult([{ id: 'budget-item-id' }]);
        }
        if (sql.includes('insert into expense_notification_imports')) {
          return values?.[1] === 'source-new' ? queryResult([{ id: 'claim-id' }]) : queryResult();
        }
        if (sql.includes('from expense_notification_imports eni')) {
          return queryResult([duplicate]);
        }
        if (sql.includes('insert into expenses')) {
          return queryResult([created]);
        }
        return queryResult();
      })
    };
    const database = {
      query: vi.fn(),
      transaction: vi.fn((callback: (transactionClient: typeof client) => Promise<unknown>) =>
        callback(client)
      )
    };
    const realtime = createRealtime();
    const service = new ExpensesService(database as never, realtime as never);

    await expect(
      service.importExpenses('household-id', [
        {
          amount: 24.5,
          budgetItemId: 'budget-item-id',
          clientId: 'client-created',
          name: 'Sklep',
          occurredAt: '2026-07-26T07:30:00.000Z',
          originalAmount: 24.5,
          originalCurrency: 'PLN',
          sourceExternalId: 'source-new'
        },
        {
          amount: 5.5,
          budgetItemId: 'budget-item-id',
          clientId: 'client-duplicate',
          name: 'Bilet',
          occurredAt: '2026-07-25T18:30:00.000Z',
          originalAmount: 5.5,
          originalCurrency: 'EUR',
          sourceExternalId: 'source-existing'
        },
        {
          amount: 100,
          budgetItemId: 'deleted-budget-item',
          clientId: 'client-failed',
          name: 'Nie zapisuj',
          occurredAt: '2026-07-26T06:00:00.000Z',
          sourceExternalId: 'source-failed'
        }
      ])
    ).resolves.toEqual({
      items: [
        {
          clientId: 'client-created',
          expense: expect.objectContaining({ id: 'created-expense-id' }),
          status: 'created'
        },
        {
          clientId: 'client-duplicate',
          expense: expect.objectContaining({ id: 'existing-expense-id' }),
          status: 'duplicate'
        },
        {
          clientId: 'client-failed',
          message: 'Budget item is not editable in this household',
          status: 'failed'
        }
      ]
    });

    const expenseInsert = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('insert into expenses')
    );
    const budgetItemLock = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('from budget_items bi')
    );
    expect(String(budgetItemLock?.[0])).toContain('for update of bi');
    expect(expenseInsert?.[1]).toEqual([
      'household-id',
      'budget-item-id',
      24.5,
      'Sklep',
      'source-new',
      '2026-07-26T07:30:00.000Z',
      24.5,
      'PLN',
      null,
      null
    ]);
    expect(realtime.publish).toHaveBeenCalledTimes(1);
  });

  it('keeps a server-side idempotency tombstone after an imported expense is deleted', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('from budget_items bi')) {
          return queryResult([{ id: 'budget-item-id' }]);
        }
        return queryResult();
      })
    };
    const database = {
      query: vi.fn(),
      transaction: vi.fn((callback: (transactionClient: typeof client) => Promise<unknown>) =>
        callback(client)
      )
    };
    const realtime = createRealtime();
    const service = new ExpensesService(database as never, realtime as never);

    await expect(
      service.importExpenses('household-id', [
        {
          amount: 12,
          budgetItemId: 'budget-item-id',
          clientId: 'client-id',
          name: 'Usunięty wydatek',
          occurredAt: '2026-07-26T07:30:00.000Z',
          sourceExternalId: 'source-existing'
        }
      ])
    ).resolves.toEqual({
      items: [{ clientId: 'client-id', expense: undefined, status: 'duplicate' }]
    });

    expect(
      client.query.mock.calls.filter(([sql]) =>
        String(sql).includes('insert into expense_notification_imports')
      )
    ).toHaveLength(1);
    expect(realtime.publish).not.toHaveBeenCalled();
  });

  it('keeps encrypted import metadata out of plaintext expense columns', async () => {
    const encryptedExpense = expenseRow({
      amount: '0.01',
      encrypted_payload: 'homeapp:v1:nonce:ciphertext',
      encryption_version: 3,
      id: 'encrypted-expense-id',
      name: '[Zaszyfrowany wydatek]',
      source: 'bank_notification',
      source_external_id: 'source-encrypted'
    });
    const client = {
      query: vi.fn(async (sql: string, _parameters?: unknown[]) => {
        if (sql.includes('from budget_items bi')) {
          return queryResult([{ id: 'budget-item-id' }]);
        }
        if (sql.includes('insert into expense_notification_imports')) {
          return queryResult([{ id: 'claim-id' }]);
        }
        if (sql.includes('insert into expenses')) {
          return queryResult([encryptedExpense]);
        }
        return queryResult();
      })
    };
    const database = {
      query: vi.fn(),
      transaction: vi.fn((callback: (transactionClient: typeof client) => Promise<unknown>) =>
        callback(client)
      )
    };
    const realtime = createRealtime();
    const service = new ExpensesService(database as never, realtime as never);

    await expect(
      service.importExpenses('household-id', [
        {
          amount: 0.01,
          budgetItemId: 'budget-item-id',
          clientId: 'client-encrypted',
          encryptedPayload: 'homeapp:v1:nonce:ciphertext',
          encryptionVersion: 3,
          sourceExternalId: 'source-encrypted'
        }
      ])
    ).resolves.toEqual({
      items: [
        {
          clientId: 'client-encrypted',
          expense: expect.objectContaining({ id: 'encrypted-expense-id' }),
          status: 'created'
        }
      ]
    });

    const expenseInsert = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('insert into expenses')
    );
    expect(expenseInsert?.[1]).toEqual([
      'household-id',
      'budget-item-id',
      0.01,
      '[Zaszyfrowany wydatek]',
      'source-encrypted',
      null,
      null,
      null,
      'homeapp:v1:nonce:ciphertext',
      3
    ]);
  });

  it('aborts the batch when the database fails unexpectedly', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('from budget_items bi')) {
          return queryResult([{ id: 'budget-item-id' }]);
        }
        throw new Error('database unavailable');
      })
    };
    const database = {
      query: vi.fn(),
      transaction: vi.fn((callback: (transactionClient: typeof client) => Promise<unknown>) =>
        callback(client)
      )
    };
    const service = new ExpensesService(database as never, createRealtime() as never);

    await expect(
      service.importExpenses('household-id', [
        {
          amount: 12,
          budgetItemId: 'budget-item-id',
          clientId: 'client-id',
          occurredAt: '2026-07-26T07:30:00.000Z',
          sourceExternalId: 'source-new'
        }
      ])
    ).rejects.toThrow('database unavailable');
  });
});

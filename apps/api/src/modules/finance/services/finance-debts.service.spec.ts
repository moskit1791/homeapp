import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { FinanceDebtsService } from './finance-debts.service';

function queryResult(rows: unknown[] = []) {
  return {
    rowCount: rows.length,
    rows
  };
}

function debtRow(overrides: Record<string, unknown> = {}) {
  return {
    amount: '100.00',
    created_at: '2026-06-15T08:00:00.000Z',
    due_date: null,
    household_id: 'household-id',
    id: 'debt-id',
    is_settled: false,
    lender_name: 'Malwinka',
    note: null,
    purpose: 'Odkurzacz',
    settled_at: null,
    updated_at: '2026-06-15T08:00:00.000Z',
    ...overrides
  };
}

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    amount: '40.00',
    created_at: '2026-06-15T09:00:00.000Z',
    finance_debt_id: 'debt-id',
    id: 'payment-id',
    note: null,
    paid_at: '2026-06-15',
    ...overrides
  };
}

function createRealtime() {
  return {
    publish: vi.fn()
  };
}

function createTransactionDatabase(client: { query: ReturnType<typeof vi.fn> }) {
  return {
    query: vi.fn(),
    transaction: vi.fn((callback: (transactionClient: typeof client) => Promise<unknown>) => callback(client))
  };
}

describe('FinanceDebtsService', () => {
  it('adds a partial debt payment and returns updated remaining amount', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce(queryResult([debtRow()]))
        .mockResolvedValueOnce(queryResult([{ paid_amount: '25.00' }]))
        .mockResolvedValueOnce(queryResult())
        .mockResolvedValueOnce(queryResult([debtRow()]))
    };
    const database = createTransactionDatabase(client);
    database.query.mockResolvedValueOnce(queryResult([debtRow()])).mockResolvedValueOnce(
      queryResult([
        paymentRow({ amount: '40.00', id: 'payment-new' }),
        paymentRow({
          amount: '25.00',
          id: 'payment-old',
          paid_at: '2026-06-01'
        })
      ])
    );
    const realtime = createRealtime();
    const service = new FinanceDebtsService(database as never, realtime as never);

    await expect(
      service.createPayment('household-id', 'debt-id', {
        amount: 40,
        paidAt: '2026-06-15'
      })
    ).resolves.toMatchObject({
      paidAmount: '65.00',
      remainingAmount: '35.00',
      payments: [{ amount: '40.00' }, { amount: '25.00' }]
    });

    expect(client.query.mock.calls[2]?.[0]).toContain('insert into finance_debt_payments');
    expect(client.query.mock.calls[2]?.[1]).toEqual(['debt-id', 40, '2026-06-15', null]);
    expect(realtime.publish).toHaveBeenCalledWith('household-id', 'finance.changed', 'debt-id');
  });

  it('settles debt automatically when a payment reaches zero remaining amount', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce(queryResult([debtRow()]))
        .mockResolvedValueOnce(queryResult([{ paid_amount: '60.00' }]))
        .mockResolvedValueOnce(queryResult())
        .mockResolvedValueOnce(
          queryResult([
            debtRow({
              is_settled: true,
              settled_at: '2026-06-15T09:00:00.000Z'
            })
          ])
        )
    };
    const database = createTransactionDatabase(client);
    database.query
      .mockResolvedValueOnce(queryResult([debtRow({ is_settled: true, settled_at: '2026-06-15T09:00:00.000Z' })]))
      .mockResolvedValueOnce(queryResult([paymentRow({ amount: '40.00', id: 'payment-new' }), paymentRow({ amount: '60.00', id: 'payment-old' })]));
    const service = new FinanceDebtsService(database as never, createRealtime() as never);

    const debt = await service.createPayment('household-id', 'debt-id', {
      amount: 40,
      paidAt: '2026-06-15'
    });

    expect(client.query.mock.calls[3]?.[1]).toEqual(['household-id', 'debt-id', true]);
    expect(debt).toMatchObject({
      isSettled: true,
      paidAmount: '100.00',
      remainingAmount: '0.00'
    });
  });

  it('rejects overpayments', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce(queryResult([debtRow()]))
        .mockResolvedValueOnce(queryResult([{ paid_amount: '90.00' }]))
    };
    const database = createTransactionDatabase(client);
    const realtime = createRealtime();
    const service = new FinanceDebtsService(database as never, realtime as never);

    await expect(
      service.createPayment('household-id', 'debt-id', {
        amount: 11,
        paidAt: '2026-06-15'
      })
    ).rejects.toThrow(BadRequestException);

    expect(realtime.publish).not.toHaveBeenCalled();
  });

  it('rejects debt amount changes below the paid amount', async () => {
    const database = {
      query: vi
        .fn()
        .mockResolvedValueOnce(queryResult([debtRow()]))
        .mockResolvedValueOnce(queryResult([paymentRow({ amount: '75.00' })]))
    };
    const realtime = createRealtime();
    const service = new FinanceDebtsService(database as never, realtime as never);

    await expect(
      service.updateDebt('household-id', 'debt-id', {
        amount: 70
      })
    ).rejects.toThrow(BadRequestException);

    expect(database.query).toHaveBeenCalledTimes(2);
    expect(realtime.publish).not.toHaveBeenCalled();
  });
});

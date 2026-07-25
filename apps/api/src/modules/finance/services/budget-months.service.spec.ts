import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BudgetMonthsService } from './budget-months.service';

function queryResult(rows: unknown[] = []) {
  return { rowCount: rows.length, rows };
}

function monthRow(overrides: Record<string, unknown> = {}) {
  return {
    archived_at: null,
    created_at: '2026-05-01T00:00:00.000Z',
    generated_at: '2026-05-01T00:00:00.000Z',
    household_id: 'household-a',
    id: 'month-current',
    is_current: true,
    month: 5,
    source_budget_month_id: null,
    updated_at: '2026-05-01T00:00:00.000Z',
    year: 2026,
    ...overrides
  };
}

function createRealtime() {
  return { publish: vi.fn() };
}

function createTransactionDatabase(client: { query: ReturnType<typeof vi.fn> }) {
  return {
    query: vi.fn(),
    transaction: vi.fn((callback: (transactionClient: typeof client) => Promise<unknown>) =>
      callback(client)
    )
  };
}

describe('BudgetMonthsService', () => {
  it('copies selected budget items with submitted amounts while generating next month', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce(queryResult())
        .mockResolvedValueOnce(queryResult([monthRow()]))
        .mockResolvedValueOnce(queryResult())
        .mockResolvedValueOnce(
          queryResult([monthRow({ id: 'month-next', is_current: false, month: 6 })])
        )
        .mockResolvedValueOnce(
          queryResult([
            {
              budget_amount: '80.00',
              category_id: 'category-a',
              display_order: 7,
              id: 'budget-item-a',
              name: 'Prad',
              owner_member_id: 'member-a'
            }
          ])
        )
        .mockResolvedValueOnce(queryResult())
        .mockResolvedValueOnce(queryResult([{ id: 'category-a' }]))
        .mockResolvedValueOnce(queryResult())
        .mockResolvedValueOnce(queryResult())
        .mockResolvedValueOnce(queryResult())
        .mockResolvedValueOnce(queryResult([monthRow({ id: 'month-next', month: 6 })]))
    };
    const database = createTransactionDatabase(client);
    const realtime = createRealtime();
    const service = new BudgetMonthsService(database as never, realtime as never);

    await expect(
      service.generateNextMonth('household-a', {
        categories: [{ categoryId: 'category-a', displayOrder: 0 }],
        items: [{ budgetAmount: 125.5, budgetItemId: 'budget-item-a' }]
      })
    ).resolves.toMatchObject({ id: 'month-next', isCurrent: true, month: 6 });

    expect(client.query.mock.calls[4]?.[1]).toEqual(['month-current', ['budget-item-a']]);
    expect(client.query.mock.calls[5]?.[0]).toContain('insert into budget_items');
    expect(client.query.mock.calls[5]?.[1]).toEqual([
      'month-next',
      'member-a',
      'category-a',
      'Prad',
      125.5,
      7,
      undefined,
      undefined
    ]);
    expect(client.query.mock.calls[6]?.[1]).toEqual(['household-a', ['category-a']]);
    expect(client.query.mock.calls[7]?.[0]).toContain('budget_month_category_orders');
    expect(client.query.mock.calls[7]?.[1]).toEqual(['month-next', ['category-a'], [0]]);
    expect(realtime.publish).toHaveBeenCalledWith(
      'household-a',
      'finance.month.generated',
      'month-next'
    );
  });

  it('rejects selected items that are not in the source month', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce(queryResult())
        .mockResolvedValueOnce(queryResult([monthRow()]))
        .mockResolvedValueOnce(queryResult())
        .mockResolvedValueOnce(
          queryResult([monthRow({ id: 'month-next', is_current: false, month: 6 })])
        )
        .mockResolvedValueOnce(queryResult())
    };
    const database = createTransactionDatabase(client);
    const realtime = createRealtime();
    const service = new BudgetMonthsService(database as never, realtime as never);

    await expect(
      service.generateNextMonth('household-a', { items: [{ budgetItemId: 'missing-item' }] })
    ).rejects.toThrow(BadRequestException);

    expect(realtime.publish).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { BudgetItemsService } from './budget-items.service';

function queryResult(rows: unknown[] = []) {
  return { rowCount: rows.length, rows };
}

function budgetItemRow(overrides: Record<string, unknown> = {}) {
  return {
    budget_amount: '80.00',
    budget_month_id: 'month-id',
    category_id: 'archived-category-id',
    created_at: '2026-08-01T08:00:00.000Z',
    display_order: 3,
    encrypted_payload: null,
    encryption_version: null,
    id: 'budget-item-id',
    is_deleted: false,
    name: 'Rachunek',
    owner_member_id: 'member-id',
    updated_at: '2026-08-01T08:00:00.000Z',
    ...overrides
  };
}

describe('BudgetItemsService', () => {
  it('updates an item without revalidating unchanged owner and archived category', async () => {
    const updatedRow = budgetItemRow({ budget_amount: '125.00' });
    const database = {
      query: vi
        .fn()
        .mockResolvedValueOnce(queryResult([budgetItemRow()]))
        .mockResolvedValueOnce(queryResult([updatedRow]))
    };
    const realtime = { publish: vi.fn() };
    const service = new BudgetItemsService(database as never, realtime as never);

    await expect(
      service.updateBudgetItem('household-id', 'budget-item-id', {
        budgetAmount: 125,
        categoryId: 'archived-category-id',
        name: 'Rachunek',
        ownerMemberId: 'member-id'
      })
    ).resolves.toMatchObject({
      budgetAmount: '125.00',
      categoryId: 'archived-category-id',
      ownerMemberId: 'member-id'
    });

    expect(database.query).toHaveBeenCalledTimes(2);
    expect(database.query.mock.calls[1]?.[0]).toContain('update budget_items');
    expect(realtime.publish).toHaveBeenCalledWith(
      'household-id',
      'finance.changed',
      'budget-item-id'
    );
  });

  it('still validates a newly selected owner and category', async () => {
    const updatedRow = budgetItemRow({
      category_id: 'active-category-id',
      owner_member_id: 'new-member-id'
    });
    const database = {
      query: vi
        .fn()
        .mockResolvedValueOnce(queryResult([budgetItemRow()]))
        .mockResolvedValueOnce(queryResult([{ id: 'new-member-id' }]))
        .mockResolvedValueOnce(queryResult([{ id: 'active-category-id' }]))
        .mockResolvedValueOnce(queryResult([updatedRow]))
    };
    const service = new BudgetItemsService(database as never, {
      publish: vi.fn()
    } as never);

    await expect(
      service.updateBudgetItem('household-id', 'budget-item-id', {
        categoryId: 'active-category-id',
        ownerMemberId: 'new-member-id'
      })
    ).resolves.toMatchObject({
      categoryId: 'active-category-id',
      ownerMemberId: 'new-member-id'
    });

    expect(database.query).toHaveBeenCalledTimes(4);
    expect(database.query.mock.calls[1]?.[1]).toEqual([
      'household-id',
      'new-member-id'
    ]);
    expect(database.query.mock.calls[2]?.[1]).toEqual([
      'household-id',
      'active-category-id'
    ]);
  });
});

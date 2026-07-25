import { describe, expect, it, vi } from 'vitest';
import { ShoppingService } from './shopping.service';

describe('ShoppingService', () => {
  it('returns an AI plan without storing plaintext items when the client encrypts results', async () => {
    const database = { query: vi.fn() };
    const realtime = { publish: vi.fn() };
    const shoppingAi = {
      planImport: vi.fn().mockResolvedValue({
        ignoredSourceFragments: [],
        items: [
          {
            category: 'Nabiał',
            name: 'Mleko',
            orderIndex: 0,
            quantity: '2 l',
            sourceFragmentIds: ['fragment-1']
          }
        ],
        sourceFragments: [{ id: 'fragment-1', text: 'mleko 2 l' }]
      })
    };
    const service = new ShoppingService(
      database as never,
      realtime as never,
      shoppingAi as never
    );

    const result = await service.importItemsWithAi('household-id', 'daily', {
      message: 'mleko 2 l',
      planOnly: true
    });

    expect(result).toMatchObject({
      importedCount: 0,
      items: [],
      plannedItems: [{ category: 'Nabiał', name: 'Mleko', quantity: '2 l' }]
    });
    expect(database.query).not.toHaveBeenCalled();
    expect(realtime.publish).not.toHaveBeenCalled();
  });

  it('marks an item as checked idempotently instead of toggling it', async () => {
    const database = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            category: null,
            checked_at: '2026-06-07T10:00:00.000Z',
            created_at: '2026-06-07T09:00:00.000Z',
            display_order: 0,
            household_id: 'household-id',
            id: 'item-id',
            is_checked: true,
            name: 'mleko',
            quantity: '',
            shopping_list_id: 'list-id',
            type: 'daily',
            updated_at: '2026-06-07T10:00:00.000Z'
          }
        ]
      })
    };
    const realtime = { publish: vi.fn() };
    const service = new ShoppingService(database as never, realtime as never, {} as never);

    const item = await service.checkItem('household-id', 'item-id');
    const sql = String(database.query.mock.calls[0]?.[0]);

    expect(item).toMatchObject({
      id: 'item-id',
      isChecked: true
    });
    expect(sql).toContain('is_checked = true');
    expect(sql).toContain('checked_at = coalesce(sli.checked_at, now())');
    expect(sql).not.toContain('not sli.is_checked');
    expect(database.query.mock.calls[0]?.[1]).toEqual(['household-id', 'item-id']);
    expect(realtime.publish).toHaveBeenCalledWith('household-id', 'shopping.changed', 'item-id');
  });
});

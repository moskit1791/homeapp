import { describe, expect, it, vi } from 'vitest';
import { FinanceSavingsService } from './finance-savings.service';

describe('FinanceSavingsService', () => {
  it('sorts savings accounts by the joined user display name', async () => {
    const database = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              created_at: '2026-06-11T10:00:00.000Z',
              current_amount: '100.00',
              household_id: 'household-id',
              id: 'account-id',
              last_changed_at: '2026-06-11',
              name: 'Wakacje',
              owner_member_id: 'member-id',
              target_amount: '1000.00',
              target_date: '2026-08-01',
              updated_at: '2026-06-11T10:00:00.000Z'
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [] })
    };
    const service = new FinanceSavingsService(
      database as never,
      { publish: vi.fn() } as never
    );

    const accounts = await service.listAccounts('household-id');
    const sql = String(database.query.mock.calls[0]?.[0]);

    expect(accounts).toHaveLength(1);
    expect(sql).toContain('left join users u');
    expect(sql).toContain('u.id = hm.user_id');
    expect(sql).toContain('coalesce(u.display_name, fsa.name)');
    expect(sql).not.toContain('hm.display_name');
  });
});

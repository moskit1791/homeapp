import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { EncryptionWriteInterceptor } from './encryption-write.interceptor';

describe('EncryptionWriteInterceptor AI writes', () => {
  it('forces plan-only shopping AI when the module is encrypted', async () => {
    const encryption = {
      acquireHouseholdWriteLock: vi.fn().mockResolvedValue(vi.fn()),
      getModuleEncryptionState: vi.fn().mockResolvedValue({
        enabled: true,
        keyVersion: 2
      })
    };
    const interceptor = new EncryptionWriteInterceptor(encryption as never);
    const body: Record<string, unknown> = { message: 'mleko i leki' };
    const request = {
      body,
      householdContext: { householdId: 'household-id' },
      method: 'POST',
      path: '/api/shopping-lists/daily/items/ai-import'
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request })
    };
    const next = { handle: vi.fn(() => of({ ok: true })) };

    await interceptor.intercept(context as never, next as never);

    expect(body.planOnly).toBe(true);
    expect(next.handle).toHaveBeenCalledOnce();
  });

  it.each([
    ['/api/meal-ideas/idea-id', 'meal_planner'],
    ['/api/annual-costs/cost-id', 'annual_costs'],
    ['/api/data-entries/entry-id', 'data_entries']
  ])('rejects an unencrypted PATCH to %s when %s is encrypted', async (path, module) => {
    const encryption = {
      acquireHouseholdWriteLock: vi.fn().mockResolvedValue(vi.fn()),
      getModuleEncryptionState: vi.fn().mockResolvedValue({
        enabled: true,
        keyVersion: 2
      })
    };
    const interceptor = new EncryptionWriteInterceptor(encryption as never);
    const request = {
      body: { title: 'jawny tekst' },
      householdContext: { householdId: 'household-id' },
      method: 'PATCH',
      path
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request })
    };
    const next = { handle: vi.fn(() => of({ ok: true })) };

    await expect(interceptor.intercept(context as never, next as never)).rejects.toThrow(
      `Moduł ${module} jest zaszyfrowany`
    );
    expect(next.handle).not.toHaveBeenCalled();
  });
});

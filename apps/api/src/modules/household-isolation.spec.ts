import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AnnualCostsService } from './annual-costs/annual-costs.service';
import { CleaningService } from './cleaning/cleaning.service';
import { BudgetItemsService } from './finance/services/budget-items.service';
import { ExpensesService } from './finance/services/expenses.service';
import { FinanceSavingsService } from './finance/services/finance-savings.service';
import { MealPlannerService } from './meal-planner/meal-planner.service';

function queryResult(rows: unknown[] = []) {
  return {
    rowCount: rows.length,
    rows
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
    transaction: vi.fn((callback: (transactionClient: typeof client) => Promise<unknown>) =>
      callback(client)
    )
  };
}

describe('household isolation guards in services', () => {
  it('does not create an expense for a budget item outside the current household', async () => {
    const database = {
      query: vi.fn().mockResolvedValueOnce(queryResult())
    };
    const realtime = createRealtime();
    const service = new ExpensesService(database as never, realtime as never);

    await expect(
      service.createExpense('household-b', {
        amount: 10,
        budgetItemId: 'budget-item-a'
      })
    ).rejects.toThrow(BadRequestException);

    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.query.mock.calls[0]?.[0]).toContain('bm.household_id = $1');
    expect(database.query.mock.calls[0]?.[1]).toEqual(['household-b', 'budget-item-a']);
    expect(realtime.publish).not.toHaveBeenCalled();
  });

  it('does not soft-delete a budget item when the ownership lookup misses', async () => {
    const database = {
      query: vi.fn().mockResolvedValueOnce(queryResult())
    };
    const realtime = createRealtime();
    const service = new BudgetItemsService(database as never, realtime as never);

    await expect(service.deleteBudgetItem('household-b', 'budget-item-a')).resolves.toBe(false);

    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.query.mock.calls[0]?.[0]).toContain('bm.household_id = $1');
    expect(realtime.publish).not.toHaveBeenCalled();
  });

  it('does not create a savings transaction for an account outside the current household', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce(queryResult())
    };
    const database = createTransactionDatabase(client);
    const realtime = createRealtime();
    const service = new FinanceSavingsService(database as never, realtime as never);

    await expect(
      service.createTransaction('household-b', 'savings-account-a', {
        amount: 50,
        direction: 'add'
      })
    ).resolves.toBeNull();

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0]?.[0]).toContain('where household_id = $1');
    expect(client.query.mock.calls[0]?.[1]).toEqual(['household-b', 'savings-account-a']);
    expect(realtime.publish).not.toHaveBeenCalled();
  });

  it('does not load meal plan entries if the week is not in the current household', async () => {
    const database = {
      query: vi.fn().mockResolvedValueOnce(queryResult())
    };
    const realtime = createRealtime();
    const service = new MealPlannerService(database as never, realtime as never);

    await expect(service.getPlan('household-b', 'meal-plan-a')).resolves.toBeNull();

    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.query.mock.calls[0]?.[0]).toContain('where household_id = $1');
    expect(database.query.mock.calls[0]?.[1]).toEqual(['household-b', 'meal-plan-a']);
    expect(realtime.publish).not.toHaveBeenCalled();
  });

  it('does not complete a cleaning task outside the current household', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce(queryResult())
    };
    const database = createTransactionDatabase(client);
    const realtime = createRealtime();
    const service = new CleaningService(database as never, realtime as never);

    await expect(
      service.completeTask('household-b', 'member-b', 'task-a', {
        completedAt: '2026-05-30'
      })
    ).resolves.toBeNull();

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0]?.[0]).toContain('where household_id = $1');
    expect(realtime.publish).not.toHaveBeenCalled();
  });

  it('does not insert annual cost history when the cost is outside the current household', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce(queryResult()).mockResolvedValueOnce(queryResult())
    };
    const database = createTransactionDatabase(client);
    const realtime = createRealtime();
    const service = new AnnualCostsService(database as never, realtime as never);

    await expect(
      service.completeCost('household-b', 'annual-cost-a', {
        amount: 120,
        executedAt: '2026-05-30'
      })
    ).resolves.toBeNull();

    const executedSql = client.query.mock.calls.map(([sql]) => String(sql)).join('\n');

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(executedSql).toContain('ac.household_id = $1');
    expect(executedSql).not.toContain('insert into annual_cost_history');
    expect(realtime.publish).not.toHaveBeenCalled();
  });
});

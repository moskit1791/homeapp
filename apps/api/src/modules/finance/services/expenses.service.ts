import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { CreateExpenseDto } from '../dto/finance.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async createExpense(householdId: string, dto: CreateExpenseDto): Promise<ExpenseRecord> {
    await this.ensureMutableBudgetItem(householdId, dto.budgetItemId);

    const result = await this.database.query<ExpenseRow>(
      `
        insert into expenses (
          budget_item_id,
          amount
        )
        values ($1, $2)
        returning id, budget_item_id, amount, created_at, updated_at
      `,
      [dto.budgetItemId, dto.amount]
    );

    const expense = this.mapExpenseOrThrow(result.rows[0]);
    this.realtime.publish(householdId, 'finance.changed', expense.id);

    return expense;
  }

  async deleteExpense(householdId: string, expenseId: string): Promise<boolean> {
    const result = await this.database.query(
      `
        delete from expenses e
        using budget_items bi, budget_months bm
        where e.budget_item_id = bi.id
          and bi.budget_month_id = bm.id
          and bm.household_id = $1
          and e.id = $2
      `,
      [householdId, expenseId]
    );

    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, 'finance.changed', expenseId);
    }

    return deleted;
  }

  private async ensureMutableBudgetItem(
    householdId: string,
    budgetItemId: string
  ): Promise<void> {
    const result = await this.database.query<{ id: string }>(
      `
        select bi.id
        from budget_items bi
        join budget_months bm on bm.id = bi.budget_month_id
        where bm.household_id = $1
          and bi.id = $2
          and bi.is_deleted = false
        limit 1
      `,
      [householdId, budgetItemId]
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Budget item is not editable in this household');
    }
  }

  private mapExpenseOrThrow(row: ExpenseRow | undefined): ExpenseRecord {
    if (!row) {
      throw new Error('Expected expense record');
    }

    return {
      amount: row.amount,
      budgetItemId: row.budget_item_id,
      createdAt: row.created_at,
      id: row.id,
      updatedAt: row.updated_at
    };
  }
}

interface ExpenseRow {
  amount: string;
  budget_item_id: string;
  created_at: string;
  id: string;
  updated_at: string;
}

export interface ExpenseRecord {
  amount: string;
  budgetItemId: string;
  createdAt: string;
  id: string;
  updatedAt: string;
}

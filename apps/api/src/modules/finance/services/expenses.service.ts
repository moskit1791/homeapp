import { BadRequestException, Injectable } from '@nestjs/common';
import type { QueryResult, QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { CreateExpenseDto, ImportExpenseItemDto } from '../dto/finance.dto';

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
          household_id,
          budget_item_id,
          amount,
          name,
          source,
          encrypted_payload,
          encryption_version
        )
        values ($1, $2, $3, $4, 'manual', $5, $6)
        returning
          id,
          budget_item_id,
          amount,
          name,
          source,
          source_external_id,
          occurred_at,
          original_amount,
          original_currency,
          encrypted_payload,
          encryption_version,
          created_at,
          updated_at
      `,
      [
        householdId,
        dto.budgetItemId,
        dto.encryptedPayload ? 0.01 : dto.amount,
        dto.encryptedPayload ? '[Zaszyfrowany wydatek]' : (dto.name?.trim() ?? null),
        dto.encryptedPayload ?? null,
        dto.encryptionVersion ?? null
      ]
    );

    const expense = this.mapExpenseOrThrow(result.rows[0]);
    this.realtime.publish(householdId, 'finance.changed', expense.id);

    return expense;
  }

  async importExpenses(
    householdId: string,
    items: ImportExpenseItemDto[]
  ): Promise<ImportExpensesResult> {
    const results = await this.database.transaction(async (client) => {
      const itemResults: ImportExpenseItemResult[] = [];

      for (const item of items) {
        itemResults.push(await this.importExpenseItem(client, householdId, item));
      }

      return itemResults;
    });
    const created = results.filter((result) => result.status === 'created');

    if (created.length > 0) {
      this.realtime.publish(householdId, 'finance.changed', created[0]?.expense?.id);
    }

    return { items: results };
  }

  private async importExpenseItem(
    client: QueryExecutor,
    householdId: string,
    item: ImportExpenseItemDto
  ): Promise<ImportExpenseItemResult> {
    const mutable = await this.isMutableBudgetItem(client, householdId, item.budgetItemId);

    if (!mutable) {
      return {
        clientId: item.clientId,
        message: 'Budget item is not editable in this household',
        status: 'failed'
      };
    }

    const claimed = await client.query<{ id: string }>(
      `
        insert into expense_notification_imports (household_id, source_external_id)
        values ($1, $2)
        on conflict (household_id, source_external_id) do nothing
        returning id
      `,
      [householdId, item.sourceExternalId]
    );

    if (!claimed.rows[0]) {
      const existing = await client.query<ExpenseRow>(
        `
          select
            e.id,
            e.budget_item_id,
            e.amount,
            e.name,
            e.source,
            e.source_external_id,
            e.occurred_at,
            e.original_amount,
            e.original_currency,
            e.encrypted_payload,
            e.encryption_version,
            e.created_at,
            e.updated_at
          from expense_notification_imports eni
          join expenses e on e.id = eni.expense_id
          where eni.household_id = $1
            and eni.source_external_id = $2
          limit 1
        `,
        [householdId, item.sourceExternalId]
      );

      return {
        clientId: item.clientId,
        expense: existing.rows[0] ? this.mapExpenseOrThrow(existing.rows[0]) : undefined,
        status: 'duplicate'
      };
    }

    const inserted = await client.query<ExpenseRow>(
      `
        insert into expenses (
          household_id,
          budget_item_id,
          amount,
          name,
          source,
          source_external_id,
          occurred_at,
          original_amount,
          original_currency,
          encrypted_payload,
          encryption_version
        )
        values (
          $1,
          $2,
          $3,
          $4,
          'bank_notification',
          $5,
          $6,
          $7,
          $8,
          $9,
          $10
        )
        returning
          id,
          budget_item_id,
          amount,
          name,
          source,
          source_external_id,
          occurred_at,
          original_amount,
          original_currency,
          encrypted_payload,
          encryption_version,
          created_at,
          updated_at
      `,
      [
        householdId,
        item.budgetItemId,
        item.encryptedPayload ? 0.01 : item.amount,
        item.encryptedPayload
          ? '[Zaszyfrowany wydatek]'
          : (item.name?.trim() ?? 'Wydatek z powiadomienia'),
        item.sourceExternalId,
        item.encryptedPayload ? null : (item.occurredAt ?? null),
        item.encryptedPayload ? null : (item.originalAmount ?? null),
        item.encryptedPayload ? null : (item.originalCurrency ?? null),
        item.encryptedPayload ?? null,
        item.encryptionVersion ?? null
      ]
    );
    const created = this.mapExpenseOrThrow(inserted.rows[0]);

    await client.query(
      `
        update expense_notification_imports
        set expense_id = $3
        where household_id = $1
          and source_external_id = $2
      `,
      [householdId, item.sourceExternalId, created.id]
    );

    return {
      clientId: item.clientId,
      expense: created,
      status: 'created'
    };
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

  private async ensureMutableBudgetItem(householdId: string, budgetItemId: string): Promise<void> {
    if (!(await this.isMutableBudgetItem(this.database, householdId, budgetItemId))) {
      throw new BadRequestException('Budget item is not editable in this household');
    }
  }

  private async isMutableBudgetItem(
    executor: QueryExecutor,
    householdId: string,
    budgetItemId: string
  ): Promise<boolean> {
    const result = await executor.query<{ id: string }>(
      `
        select bi.id
        from budget_items bi
        join budget_months bm on bm.id = bi.budget_month_id
        where bm.household_id = $1
          and bi.id = $2
          and bi.is_deleted = false
        limit 1
        for update of bi
      `,
      [householdId, budgetItemId]
    );

    return Boolean(result.rows[0]);
  }

  private mapExpenseOrThrow(row: ExpenseRow | undefined): ExpenseRecord {
    if (!row) {
      throw new Error('Expected expense record');
    }

    return {
      amount: row.amount,
      budgetItemId: row.budget_item_id,
      createdAt: row.created_at,
      encryptedPayload: row.encrypted_payload,
      encryptionVersion: row.encryption_version,
      id: row.id,
      name: row.name,
      occurredAt: row.occurred_at,
      originalAmount: row.original_amount,
      originalCurrency: row.original_currency,
      source: row.source ?? 'manual',
      sourceExternalId: row.source_external_id,
      updatedAt: row.updated_at
    };
  }
}

interface ExpenseRow {
  amount: string;
  budget_item_id: string;
  created_at: string;
  encrypted_payload: string | null;
  encryption_version: number | null;
  id: string;
  name: string | null;
  occurred_at: string | null;
  original_amount: string | null;
  original_currency: string | null;
  source: 'manual' | 'bank_notification' | null;
  source_external_id: string | null;
  updated_at: string;
}

export interface ExpenseRecord {
  amount: string;
  budgetItemId: string;
  createdAt: string;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  id: string;
  name: string | null;
  occurredAt: string | null;
  originalAmount: string | null;
  originalCurrency: string | null;
  source: 'manual' | 'bank_notification';
  sourceExternalId: string | null;
  updatedAt: string;
}

export interface ImportExpenseItemResult {
  clientId: string;
  expense?: ExpenseRecord;
  message?: string;
  status: 'created' | 'duplicate' | 'failed';
}

export interface ImportExpensesResult {
  items: ImportExpenseItemResult[];
}

interface QueryExecutor {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>>;
}

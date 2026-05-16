import { BadRequestException, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { RealtimeService } from '../../realtime/realtime.service';
import {
  CreateFinanceSavingsAccountDto,
  CreateFinanceSavingsTransactionDto
} from '../dto/finance.dto';

@Injectable()
export class FinanceSavingsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async listAccounts(householdId: string): Promise<FinanceSavingsAccountRecord[]> {
    const accounts = await this.database.query<FinanceSavingsAccountRow>(
      `
        select id, household_id, name, current_amount, last_changed_at, created_at, updated_at
        from finance_savings_accounts
        where household_id = $1
        order by name asc
      `,
      [householdId]
    );

    return this.attachTransactions(accounts.rows);
  }

  async createAccount(
    householdId: string,
    dto: CreateFinanceSavingsAccountDto
  ): Promise<FinanceSavingsAccountRecord> {
    const created = await this.database.transaction(async (client) => {
      const changedAt = dto.changedAt ?? this.todayIso();
      const account = await client.query<FinanceSavingsAccountRow>(
        `
          insert into finance_savings_accounts (
            household_id,
            name,
            current_amount,
            last_changed_at
          )
          values ($1, $2, $3, $4)
          returning id, household_id, name, current_amount, last_changed_at, created_at, updated_at
        `,
        [householdId, this.normalizeText(dto.name, 'Savings name'), dto.amount, changedAt]
      );

      const row = this.mapAccountRowOrThrow(account.rows[0]);

      if (dto.amount > 0) {
        await this.insertTransaction(client, row.id, {
          amount: dto.amount,
          changedAt,
          direction: 'add',
          note: dto.note ?? null
        });
      }

      return row;
    });

    this.realtime.publish(householdId, 'finance.changed', created.id);

    return this.getAccountOrThrow(householdId, created.id);
  }

  async createTransaction(
    householdId: string,
    accountId: string,
    dto: CreateFinanceSavingsTransactionDto
  ): Promise<FinanceSavingsAccountRecord | null> {
    const updated = await this.database.transaction(async (client) => {
      const account = await client.query<FinanceSavingsAccountRow>(
        `
          select id, household_id, name, current_amount, last_changed_at, created_at, updated_at
          from finance_savings_accounts
          where household_id = $1
            and id = $2
          for update
        `,
        [householdId, accountId]
      );
      const row = account.rows[0];

      if (!row) {
        return null;
      }

      const currentAmount = Number(row.current_amount);
      const delta = dto.direction === 'add' ? dto.amount : -dto.amount;
      const nextAmount = Math.round((currentAmount + delta) * 100) / 100;

      if (nextAmount < 0) {
        throw new BadRequestException('Savings amount cannot be negative');
      }

      const changedAt = dto.changedAt ?? this.todayIso();

      await this.insertTransaction(client, accountId, {
        amount: dto.amount,
        changedAt,
        direction: dto.direction,
        note: dto.note ?? null
      });

      const update = await client.query<FinanceSavingsAccountRow>(
        `
          update finance_savings_accounts
          set current_amount = $3,
              last_changed_at = $4
          where household_id = $1
            and id = $2
          returning id, household_id, name, current_amount, last_changed_at, created_at, updated_at
        `,
        [householdId, accountId, nextAmount, changedAt]
      );

      return this.mapAccountRowOrThrow(update.rows[0]);
    });

    if (updated) {
      this.realtime.publish(householdId, 'finance.changed', updated.id);

      return this.getAccountOrThrow(householdId, updated.id);
    }

    return null;
  }

  async deleteAccount(householdId: string, accountId: string): Promise<boolean> {
    const result = await this.database.query(
      `
        delete from finance_savings_accounts
        where household_id = $1
          and id = $2
      `,
      [householdId, accountId]
    );
    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, 'finance.changed', accountId);
    }

    return deleted;
  }

  private async getAccountOrThrow(
    householdId: string,
    accountId: string
  ): Promise<FinanceSavingsAccountRecord> {
    const result = await this.database.query<FinanceSavingsAccountRow>(
      `
        select id, household_id, name, current_amount, last_changed_at, created_at, updated_at
        from finance_savings_accounts
        where household_id = $1
          and id = $2
        limit 1
      `,
      [householdId, accountId]
    );
    const accounts = await this.attachTransactions(result.rows);
    const account = accounts[0];

    if (!account) {
      throw new Error('Expected finance savings account');
    }

    return account;
  }

  private async attachTransactions(
    accountRows: FinanceSavingsAccountRow[]
  ): Promise<FinanceSavingsAccountRecord[]> {
    if (accountRows.length === 0) {
      return [];
    }

    const accountIds = accountRows.map((row) => row.id);
    const transactionRows = await this.database.query<FinanceSavingsTransactionRow>(
      `
        select
          id,
          savings_account_id,
          direction,
          amount,
          changed_at,
          note,
          created_at
        from finance_savings_transactions
        where savings_account_id = any($1::uuid[])
        order by changed_at desc, created_at desc
      `,
      [accountIds]
    );
    const byAccount = new Map<string, FinanceSavingsTransactionRecord[]>();

    transactionRows.rows.forEach((row) => {
      const current = byAccount.get(row.savings_account_id) ?? [];

      current.push(this.mapTransaction(row));
      byAccount.set(row.savings_account_id, current);
    });

    return accountRows.map((row) => ({
      ...this.mapAccountRowOrThrow(row),
      transactions: byAccount.get(row.id) ?? []
    }));
  }

  private async insertTransaction(
    client: PoolClient,
    savingsAccountId: string,
    input: {
      amount: number;
      changedAt: string;
      direction: 'add' | 'subtract';
      note: string | null;
    }
  ) {
    await client.query(
      `
        insert into finance_savings_transactions (
          savings_account_id,
          direction,
          amount,
          changed_at,
          note
        )
        values ($1, $2, $3, $4, $5)
      `,
      [savingsAccountId, input.direction, input.amount, input.changedAt, this.normalizeOptionalText(input.note)]
    );
  }

  private normalizeText(value: string, label: string): string {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException(`${label} cannot be empty`);
    }

    return normalized;
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();

    return normalized ? normalized : null;
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private mapAccountRowOrThrow(row: FinanceSavingsAccountRow | undefined): FinanceSavingsAccountRecord {
    if (!row) {
      throw new Error('Expected finance savings account');
    }

    return {
      createdAt: row.created_at,
      currentAmount: String(row.current_amount),
      householdId: row.household_id,
      id: row.id,
      lastChangedAt: this.formatDateOnly(row.last_changed_at),
      name: row.name,
      transactions: [],
      updatedAt: row.updated_at
    };
  }

  private mapTransaction(row: FinanceSavingsTransactionRow): FinanceSavingsTransactionRecord {
    return {
      amount: String(row.amount),
      changedAt: this.formatDateOnly(row.changed_at),
      createdAt: row.created_at,
      direction: row.direction,
      id: row.id,
      note: row.note,
      savingsAccountId: row.savings_account_id
    };
  }

  private formatDateOnly(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return String(value).slice(0, 10);
  }
}

interface FinanceSavingsAccountRow {
  created_at: string;
  current_amount: string;
  household_id: string;
  id: string;
  last_changed_at: Date | string;
  name: string;
  updated_at: string;
}

interface FinanceSavingsTransactionRow {
  amount: string;
  changed_at: Date | string;
  created_at: string;
  direction: 'add' | 'subtract';
  id: string;
  note: string | null;
  savings_account_id: string;
}

export interface FinanceSavingsAccountRecord {
  createdAt: string;
  currentAmount: string;
  householdId: string;
  id: string;
  lastChangedAt: string;
  name: string;
  transactions: FinanceSavingsTransactionRecord[];
  updatedAt: string;
}

export interface FinanceSavingsTransactionRecord {
  amount: string;
  changedAt: string;
  createdAt: string;
  direction: 'add' | 'subtract';
  id: string;
  note: string | null;
  savingsAccountId: string;
}

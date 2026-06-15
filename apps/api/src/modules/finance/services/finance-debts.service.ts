import { BadRequestException, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { CreateFinanceDebtDto, CreateFinanceDebtPaymentDto, UpdateFinanceDebtDto } from '../dto/finance.dto';

@Injectable()
export class FinanceDebtsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async listDebts(householdId: string, includeSettled = false): Promise<FinanceDebtRecord[]> {
    const result = await this.database.query<FinanceDebtRow>(
      `
        select id, household_id, lender_name, purpose, amount, due_date, note, is_settled, settled_at, created_at, updated_at
        from finance_debts
        where household_id = $1
          and ($2 = true or is_settled = false)
        order by is_settled asc, due_date asc nulls last, created_at desc
      `,
      [householdId, includeSettled]
    );

    return this.attachPayments(householdId, result.rows);
  }

  async createDebt(householdId: string, dto: CreateFinanceDebtDto): Promise<FinanceDebtRecord> {
    const result = await this.database.query<FinanceDebtRow>(
      `
        insert into finance_debts (household_id, lender_name, purpose, amount, due_date, note)
        values ($1, $2, $3, $4, $5, $6)
        returning id, household_id, lender_name, purpose, amount, due_date, note, is_settled, settled_at, created_at, updated_at
      `,
      [householdId, this.normalizeText(dto.lenderName, 'Lender name'), this.normalizeText(dto.purpose, 'Purpose'), dto.amount, dto.dueDate ?? null, this.normalizeOptionalText(dto.note)]
    );

    const debt = await this.getDebtOrThrow(householdId, this.mapDebtRowOrThrow(result.rows[0]).id);
    this.realtime.publish(householdId, 'finance.changed', debt.id);

    return debt;
  }

  async updateDebt(householdId: string, debtId: string, dto: UpdateFinanceDebtDto): Promise<FinanceDebtRecord | null> {
    if (dto.amount === undefined && dto.dueDate === undefined && dto.isSettled === undefined && dto.lenderName === undefined && dto.note === undefined && dto.purpose === undefined) {
      throw new BadRequestException('No finance debt fields to update');
    }

    const current = await this.findDebt(householdId, debtId);

    if (!current) {
      return null;
    }

    const nextAmount = dto.amount ?? Number(current.amount);

    if (this.roundMoney(nextAmount) < this.roundMoney(Number(current.paidAmount))) {
      throw new BadRequestException('Debt amount cannot be lower than paid amount');
    }

    const nextRemainingAmount = this.roundMoney(nextAmount - Number(current.paidAmount));
    const nextSettled = nextRemainingAmount <= 0 ? true : (dto.isSettled ?? current.isSettled);
    const result = await this.database.query<FinanceDebtRow>(
      `
        update finance_debts
        set
          lender_name = coalesce($3, lender_name),
          purpose = coalesce($4, purpose),
          amount = coalesce($5, amount),
          due_date = $6,
          note = $7,
          is_settled = $8,
          settled_at = case
            when $8 = true and is_settled = false then now()
            when $8 = false then null
            else settled_at
          end
        where household_id = $1
          and id = $2
        returning id, household_id, lender_name, purpose, amount, due_date, note, is_settled, settled_at, created_at, updated_at
      `,
      [
        householdId,
        debtId,
        dto.lenderName === undefined ? null : this.normalizeText(dto.lenderName, 'Lender name'),
        dto.purpose === undefined ? null : this.normalizeText(dto.purpose, 'Purpose'),
        dto.amount ?? null,
        dto.dueDate === undefined ? current.dueDate : dto.dueDate,
        dto.note === undefined ? current.note : this.normalizeOptionalText(dto.note),
        nextSettled
      ]
    );

    const debt = result.rows[0] ? ((await this.attachPayments(householdId, [result.rows[0]]))[0] ?? null) : null;

    if (debt) {
      this.realtime.publish(householdId, 'finance.changed', debt.id);
    }

    return debt;
  }

  async createPayment(householdId: string, debtId: string, dto: CreateFinanceDebtPaymentDto): Promise<FinanceDebtRecord | null> {
    const updated = await this.database.transaction(async (client) => {
      const debt = await client.query<FinanceDebtRow>(
        `
          select id, household_id, lender_name, purpose, amount, due_date, note, is_settled, settled_at, created_at, updated_at
          from finance_debts
          where household_id = $1
            and id = $2
          for update
        `,
        [householdId, debtId]
      );
      const current = debt.rows[0];

      if (!current) {
        return null;
      }

      const paid = await client.query<{ paid_amount: string }>(
        `
          select coalesce(sum(amount), 0)::numeric(12, 2) as paid_amount
          from finance_debt_payments
          where finance_debt_id = $1
        `,
        [debtId]
      );
      const paidAmount = this.roundMoney(Number(paid.rows[0]?.paid_amount ?? 0));
      const paymentAmount = this.roundMoney(dto.amount);
      const remainingAmount = this.roundMoney(Number(current.amount) - paidAmount);

      if (paymentAmount > remainingAmount) {
        throw new BadRequestException('Debt payment cannot exceed remaining amount');
      }

      const paidAt = dto.paidAt ?? this.todayIso();

      await this.insertPayment(client, debtId, {
        amount: paymentAmount,
        note: dto.note ?? null,
        paidAt
      });

      const nextPaidAmount = this.roundMoney(paidAmount + paymentAmount);
      const nextRemainingAmount = this.roundMoney(Number(current.amount) - nextPaidAmount);
      const shouldSettle = nextRemainingAmount <= 0;
      const update = await client.query<FinanceDebtRow>(
        `
          update finance_debts
          set
            is_settled = case when $3 = true then true else is_settled end,
            settled_at = case
              when $3 = true and is_settled = false then now()
              else settled_at
            end
          where household_id = $1
            and id = $2
          returning id, household_id, lender_name, purpose, amount, due_date, note, is_settled, settled_at, created_at, updated_at
        `,
        [householdId, debtId, shouldSettle]
      );

      return update.rows[0] ?? null;
    });

    if (!updated) {
      return null;
    }

    this.realtime.publish(householdId, 'finance.changed', debtId);

    return this.getDebtOrThrow(householdId, debtId);
  }

  async deleteDebt(householdId: string, debtId: string): Promise<boolean> {
    const result = await this.database.query(
      `
        delete from finance_debts
        where household_id = $1
          and id = $2
      `,
      [householdId, debtId]
    );
    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, 'finance.changed', debtId);
    }

    return deleted;
  }

  private async findDebt(householdId: string, debtId: string): Promise<FinanceDebtRecord | null> {
    const result = await this.database.query<FinanceDebtRow>(
      `
        select id, household_id, lender_name, purpose, amount, due_date, note, is_settled, settled_at, created_at, updated_at
        from finance_debts
        where household_id = $1
          and id = $2
        limit 1
      `,
      [householdId, debtId]
    );

    return result.rows[0] ? ((await this.attachPayments(householdId, [result.rows[0]]))[0] ?? null) : null;
  }

  private async getDebtOrThrow(householdId: string, debtId: string): Promise<FinanceDebtRecord> {
    const debt = await this.findDebt(householdId, debtId);

    if (!debt) {
      throw new Error('Expected finance debt record');
    }

    return debt;
  }

  private async attachPayments(householdId: string, debtRows: FinanceDebtRow[]): Promise<FinanceDebtRecord[]> {
    if (debtRows.length === 0) {
      return [];
    }

    const debtIds = debtRows.map((row) => row.id);
    const paymentRows = await this.database.query<FinanceDebtPaymentRow>(
      `
        select
          fdp.id,
          fdp.finance_debt_id,
          fdp.amount,
          fdp.paid_at,
          fdp.note,
          fdp.created_at
        from finance_debt_payments fdp
        join finance_debts fd
          on fd.id = fdp.finance_debt_id
        where fd.household_id = $1
          and fdp.finance_debt_id = any($2::uuid[])
        order by fdp.paid_at desc, fdp.created_at desc
      `,
      [householdId, debtIds]
    );
    const byDebt = new Map<string, FinanceDebtPaymentRecord[]>();

    paymentRows.rows.forEach((row) => {
      const current = byDebt.get(row.finance_debt_id) ?? [];

      current.push(this.mapPayment(row));
      byDebt.set(row.finance_debt_id, current);
    });

    return debtRows.map((row) => this.mapDebt(row, byDebt.get(row.id) ?? []));
  }

  private async insertPayment(client: PoolClient, debtId: string, input: { amount: number; note: string | null; paidAt: string }): Promise<void> {
    await client.query(
      `
        insert into finance_debt_payments (
          finance_debt_id,
          amount,
          paid_at,
          note
        )
        values ($1, $2, $3, $4)
      `,
      [debtId, input.amount, input.paidAt, this.normalizeOptionalText(input.note)]
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

  private mapDebtRowOrThrow(row: FinanceDebtRow | undefined): FinanceDebtRow {
    if (!row) {
      throw new Error('Expected finance debt record');
    }

    return row;
  }

  private mapDebt(row: FinanceDebtRow, payments: FinanceDebtPaymentRecord[]): FinanceDebtRecord {
    const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const remainingAmount = Math.max(0, this.roundMoney(Number(row.amount) - paidAmount));

    return {
      amount: String(row.amount),
      createdAt: row.created_at,
      dueDate: this.formatDateOnly(row.due_date),
      householdId: row.household_id,
      id: row.id,
      isSettled: row.is_settled,
      lenderName: row.lender_name,
      note: row.note,
      paidAmount: this.formatMoneyValue(paidAmount),
      payments,
      purpose: row.purpose,
      remainingAmount: this.formatMoneyValue(remainingAmount),
      settledAt: row.settled_at,
      updatedAt: row.updated_at
    };
  }

  private mapPayment(row: FinanceDebtPaymentRow): FinanceDebtPaymentRecord {
    return {
      amount: String(row.amount),
      createdAt: row.created_at,
      debtId: row.finance_debt_id,
      id: row.id,
      note: row.note,
      paidAt: this.formatDateOnly(row.paid_at)
    };
  }

  private formatDateOnly(value: Date | string | null): string | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return String(value).slice(0, 10);
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private formatMoneyValue(value: number): string {
    return this.roundMoney(value).toFixed(2);
  }
}

interface FinanceDebtRow {
  amount: string;
  created_at: string;
  due_date: Date | string | null;
  household_id: string;
  id: string;
  is_settled: boolean;
  lender_name: string;
  note: string | null;
  purpose: string;
  settled_at: string | null;
  updated_at: string;
}

interface FinanceDebtPaymentRow {
  amount: string;
  created_at: string;
  finance_debt_id: string;
  id: string;
  note: string | null;
  paid_at: Date | string;
}

export interface FinanceDebtRecord {
  amount: string;
  createdAt: string;
  dueDate: string | null;
  householdId: string;
  id: string;
  isSettled: boolean;
  lenderName: string;
  note: string | null;
  paidAmount: string;
  payments: FinanceDebtPaymentRecord[];
  purpose: string;
  remainingAmount: string;
  settledAt: string | null;
  updatedAt: string;
}

export interface FinanceDebtPaymentRecord {
  amount: string;
  createdAt: string;
  debtId: string;
  id: string;
  note: string | null;
  paidAt: string | null;
}

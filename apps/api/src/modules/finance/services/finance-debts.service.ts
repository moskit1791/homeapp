import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { CreateFinanceDebtDto, UpdateFinanceDebtDto } from '../dto/finance.dto';

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

    return result.rows.map((row) => this.mapDebt(row));
  }

  async createDebt(householdId: string, dto: CreateFinanceDebtDto): Promise<FinanceDebtRecord> {
    const result = await this.database.query<FinanceDebtRow>(
      `
        insert into finance_debts (household_id, lender_name, purpose, amount, due_date, note)
        values ($1, $2, $3, $4, $5, $6)
        returning id, household_id, lender_name, purpose, amount, due_date, note, is_settled, settled_at, created_at, updated_at
      `,
      [
        householdId,
        this.normalizeText(dto.lenderName, 'Lender name'),
        this.normalizeText(dto.purpose, 'Purpose'),
        dto.amount,
        dto.dueDate ?? null,
        this.normalizeOptionalText(dto.note)
      ]
    );

    const debt = this.mapDebtOrThrow(result.rows[0]);
    this.realtime.publish(householdId, 'finance.changed', debt.id);

    return debt;
  }

  async updateDebt(
    householdId: string,
    debtId: string,
    dto: UpdateFinanceDebtDto
  ): Promise<FinanceDebtRecord | null> {
    if (
      dto.amount === undefined &&
      dto.dueDate === undefined &&
      dto.isSettled === undefined &&
      dto.lenderName === undefined &&
      dto.note === undefined &&
      dto.purpose === undefined
    ) {
      throw new BadRequestException('No finance debt fields to update');
    }

    const current = await this.findDebt(householdId, debtId);

    if (!current) {
      return null;
    }

    const nextSettled = dto.isSettled ?? current.isSettled;
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

    const debt = result.rows[0] ? this.mapDebt(result.rows[0]) : null;

    if (debt) {
      this.realtime.publish(householdId, 'finance.changed', debt.id);
    }

    return debt;
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

    return result.rows[0] ? this.mapDebt(result.rows[0]) : null;
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

  private mapDebtOrThrow(row: FinanceDebtRow | undefined): FinanceDebtRecord {
    if (!row) {
      throw new Error('Expected finance debt record');
    }

    return this.mapDebt(row);
  }

  private mapDebt(row: FinanceDebtRow): FinanceDebtRecord {
    return {
      amount: String(row.amount),
      createdAt: row.created_at,
      dueDate: this.formatDateOnly(row.due_date),
      householdId: row.household_id,
      id: row.id,
      isSettled: row.is_settled,
      lenderName: row.lender_name,
      note: row.note,
      purpose: row.purpose,
      settledAt: row.settled_at,
      updatedAt: row.updated_at
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

export interface FinanceDebtRecord {
  amount: string;
  createdAt: string;
  dueDate: string | null;
  householdId: string;
  id: string;
  isSettled: boolean;
  lenderName: string;
  note: string | null;
  purpose: string;
  settledAt: string | null;
  updatedAt: string;
}

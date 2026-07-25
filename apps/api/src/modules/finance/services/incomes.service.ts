import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { UpsertIncomeDto } from '../dto/finance.dto';

@Injectable()
export class IncomesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async upsertCurrentIncome(
    householdId: string,
    memberId: string,
    dto: UpsertIncomeDto
  ): Promise<IncomeRecord> {
    const budgetMonthId = dto.budgetMonthId
      ? await this.ensureBudgetMonth(householdId, dto.budgetMonthId)
      : await this.getCurrentBudgetMonthId(householdId);
    await this.ensureActiveMember(householdId, memberId);

    const result = await this.database.query<IncomeRow>(
      `
        insert into monthly_incomes (
          budget_month_id,
          owner_member_id,
          amount,
          encrypted_payload,
          encryption_version
        )
        values ($1, $2, $3, $4, $5)
        on conflict (budget_month_id, owner_member_id) do update
        set
          amount = excluded.amount,
          encrypted_payload = excluded.encrypted_payload,
          encryption_version = excluded.encryption_version
        returning id, budget_month_id, owner_member_id, amount, encrypted_payload, encryption_version, created_at, updated_at
      `,
      [
        budgetMonthId,
        memberId,
        dto.encryptedPayload ? 0 : dto.amount,
        dto.encryptedPayload ?? null,
        dto.encryptionVersion ?? null
      ]
    );

    const income = this.mapIncomeOrThrow(result.rows[0]);
    this.realtime.publish(householdId, 'finance.changed', income.id);

    return income;
  }

  private async ensureBudgetMonth(householdId: string, budgetMonthId: string): Promise<string> {
    const result = await this.database.query<{ id: string }>(
      `
        select id
        from budget_months
        where household_id = $1
          and id = $2
        limit 1
      `,
      [householdId, budgetMonthId]
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Budget month not found');
    }

    return budgetMonthId;
  }

  private async getCurrentBudgetMonthId(householdId: string): Promise<string> {
    const result = await this.database.query<{ id: string }>(
      `
        select id
        from budget_months
        where household_id = $1
          and is_current = true
        limit 1
      `,
      [householdId]
    );

    const current = result.rows[0];

    if (!current) {
      throw new BadRequestException('Current budget month not found');
    }

    return current.id;
  }

  private async ensureActiveMember(householdId: string, memberId: string): Promise<void> {
    const result = await this.database.query<{ id: string }>(
      `
        select id
        from household_members
        where household_id = $1
          and id = $2
          and is_active = true
        limit 1
      `,
      [householdId, memberId]
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Income owner member is not active in household');
    }
  }

  private mapIncomeOrThrow(row: IncomeRow | undefined): IncomeRecord {
    if (!row) {
      throw new Error('Expected income record');
    }

    return {
      amount: row.amount,
      budgetMonthId: row.budget_month_id,
      createdAt: row.created_at,
      encryptedPayload: row.encrypted_payload,
      encryptionVersion: row.encryption_version,
      id: row.id,
      ownerMemberId: row.owner_member_id,
      updatedAt: row.updated_at
    };
  }
}

interface IncomeRow {
  amount: string;
  budget_month_id: string;
  created_at: string;
  encrypted_payload: string | null;
  encryption_version: number | null;
  id: string;
  owner_member_id: string;
  updated_at: string;
}

export interface IncomeRecord {
  amount: string;
  budgetMonthId: string;
  createdAt: string;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  id: string;
  ownerMemberId: string;
  updatedAt: string;
}

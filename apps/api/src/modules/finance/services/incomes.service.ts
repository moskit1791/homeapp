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
    const budgetMonthId = await this.getCurrentBudgetMonthId(householdId);
    await this.ensureActiveMember(householdId, memberId);

    const result = await this.database.query<IncomeRow>(
      `
        insert into monthly_incomes (
          budget_month_id,
          owner_member_id,
          amount
        )
        values ($1, $2, $3)
        on conflict (budget_month_id, owner_member_id) do update
        set amount = excluded.amount
        returning id, budget_month_id, owner_member_id, amount, created_at, updated_at
      `,
      [budgetMonthId, memberId, dto.amount]
    );

    const income = this.mapIncomeOrThrow(result.rows[0]);
    this.realtime.publish(householdId, 'finance.changed', income.id);

    return income;
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
  id: string;
  owner_member_id: string;
  updated_at: string;
}

export interface IncomeRecord {
  amount: string;
  budgetMonthId: string;
  createdAt: string;
  id: string;
  ownerMemberId: string;
  updatedAt: string;
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { RealtimeService } from '../../realtime/realtime.service';

@Injectable()
export class BudgetMonthsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async getCurrentMonth(householdId: string): Promise<BudgetMonthRecord> {
    const result = await this.database.query<BudgetMonthRow>(
      `
        select
          id,
          household_id,
          year,
          month,
          source_budget_month_id,
          is_current,
          generated_at,
          archived_at,
          created_at,
          updated_at
        from budget_months
        where household_id = $1
          and is_current = true
        limit 1
      `,
      [householdId]
    );

    return this.mapMonthOrThrow(result.rows[0], 'Current budget month not found');
  }

  async getMonth(householdId: string, monthId: string): Promise<BudgetMonthRecord> {
    const result = await this.database.query<BudgetMonthRow>(
      `
        select
          id,
          household_id,
          year,
          month,
          source_budget_month_id,
          is_current,
          generated_at,
          archived_at,
          created_at,
          updated_at
        from budget_months
        where household_id = $1
          and id = $2
        limit 1
      `,
      [householdId, monthId]
    );

    return this.mapMonthOrThrow(result.rows[0], 'Budget month not found');
  }

  async listArchive(householdId: string): Promise<BudgetMonthRecord[]> {
    const result = await this.database.query<BudgetMonthRow>(
      `
        select
          id,
          household_id,
          year,
          month,
          source_budget_month_id,
          is_current,
          generated_at,
          archived_at,
          created_at,
          updated_at
        from budget_months
        where household_id = $1
          and is_current = false
        order by year desc, month desc, generated_at desc
      `,
      [householdId]
    );

    return result.rows.map((row) => this.mapMonth(row));
  }

  async deleteMonth(householdId: string, monthId: string): Promise<boolean> {
    const deleted = await this.database.transaction(async (client) => {
      await client.query(
        `
          select pg_advisory_xact_lock(hashtext('homeapp.finance.month'), hashtext($1))
        `,
        [householdId]
      );

      const targetResult = await client.query<BudgetMonthRow>(
        `
          select
            id,
            household_id,
            year,
            month,
            source_budget_month_id,
            is_current,
            generated_at,
            archived_at,
            created_at,
            updated_at
          from budget_months
          where household_id = $1
            and id = $2
          limit 1
          for update
        `,
        [householdId, monthId]
      );
      const target = targetResult.rows[0];

      if (!target) {
        return false;
      }

      if (!target.is_current) {
        await client.query(
          `
            delete from budget_months
            where household_id = $1
              and id = $2
          `,
          [householdId, monthId]
        );

        return true;
      }

      const fallbackResult = await client.query<BudgetMonthRow>(
        `
          select
            id,
            household_id,
            year,
            month,
            source_budget_month_id,
            is_current,
            generated_at,
            archived_at,
            created_at,
            updated_at
          from budget_months
          where household_id = $1
            and id <> $2
          order by
            case when id = $3::uuid then 0 else 1 end,
            year desc,
            month desc,
            generated_at desc
          limit 1
          for update
        `,
        [householdId, monthId, target.source_budget_month_id]
      );
      const fallback = fallbackResult.rows[0];

      if (!fallback) {
        throw new BadRequestException('Cannot delete the only budget month');
      }

      await client.query(
        `
          delete from budget_months
          where household_id = $1
            and id = $2
        `,
        [householdId, monthId]
      );
      await client.query(
        `
          update budget_months
          set
            is_current = true,
            archived_at = null
          where household_id = $1
            and id = $2
        `,
        [householdId, fallback.id]
      );

      return true;
    });

    if (deleted) {
      this.realtime.publish(householdId, 'finance.month.deleted', monthId);
      this.realtime.publish(householdId, 'finance.changed', monthId);
    }

    return deleted;
  }

  async generateNextMonth(householdId: string): Promise<BudgetMonthRecord> {
    const generated = await this.database.transaction(async (client) => {
      await client.query(
        `
          select pg_advisory_xact_lock(hashtext('homeapp.finance.month'), hashtext($1))
        `,
        [householdId]
      );

      const currentResult = await client.query<BudgetMonthRow>(
        `
          select
            id,
            household_id,
            year,
            month,
            source_budget_month_id,
            is_current,
            generated_at,
            archived_at,
            created_at,
            updated_at
          from budget_months
          where household_id = $1
            and is_current = true
          limit 1
          for update
        `,
        [householdId]
      );
      const current = currentResult.rows[0];

      if (!current) {
        throw new BadRequestException('Current budget month not found');
      }

      const next = this.getNextYearMonth(current.year, current.month);
      const existingNext = await client.query<{ id: string }>(
        `
          select id
          from budget_months
          where household_id = $1
            and year = $2
            and month = $3
          limit 1
        `,
        [householdId, next.year, next.month]
      );

      if (existingNext.rows[0]) {
        throw new BadRequestException('Next budget month already exists');
      }

      const nextMonthResult = await client.query<BudgetMonthRow>(
        `
          insert into budget_months (
            household_id,
            year,
            month,
            source_budget_month_id,
            is_current
          )
          values ($1, $2, $3, $4, false)
          returning
            id,
            household_id,
            year,
            month,
            source_budget_month_id,
            is_current,
            generated_at,
            archived_at,
            created_at,
            updated_at
        `,
        [householdId, next.year, next.month, current.id]
      );
      const nextMonth = this.mapMonthOrThrow(
        nextMonthResult.rows[0],
        'Expected generated budget month'
      );

      await this.copyBudgetItems(client, current.id, nextMonth.id);
      await this.createZeroIncomesForActiveMembers(client, householdId, nextMonth.id);

      await client.query(
        `
          update budget_months
          set
            is_current = false,
            archived_at = coalesce(archived_at, now())
          where id = $1
        `,
        [current.id]
      );

      const promotedResult = await client.query<BudgetMonthRow>(
        `
          update budget_months
          set is_current = true
          where id = $1
          returning
            id,
            household_id,
            year,
            month,
            source_budget_month_id,
            is_current,
            generated_at,
            archived_at,
            created_at,
            updated_at
        `,
        [nextMonth.id]
      );

      return this.mapMonthOrThrow(promotedResult.rows[0], 'Expected current budget month');
    });

    this.realtime.publish(householdId, 'finance.month.generated', generated.id);
    this.realtime.publish(householdId, 'finance.changed', generated.id);

    return generated;
  }

  private async copyBudgetItems(
    client: PoolClient,
    sourceBudgetMonthId: string,
    targetBudgetMonthId: string
  ): Promise<void> {
    await client.query(
      `
        insert into budget_items (
          budget_month_id,
          owner_member_id,
          category_id,
          name,
          budget_amount,
          display_order
        )
        select
          $2,
          bi.owner_member_id,
          bi.category_id,
          bi.name,
          null,
          bi.display_order
        from budget_items bi
        join budget_categories bc on bc.id = bi.category_id
        where bi.budget_month_id = $1
          and bi.is_deleted = false
          and bc.copy_budget_to_next_month = true
      `,
      [sourceBudgetMonthId, targetBudgetMonthId]
    );
  }

  private async createZeroIncomesForActiveMembers(
    client: PoolClient,
    householdId: string,
    budgetMonthId: string
  ): Promise<void> {
    await client.query(
      `
        insert into monthly_incomes (
          budget_month_id,
          owner_member_id,
          amount
        )
        select $2, hm.id, 0
        from household_members hm
        where hm.household_id = $1
          and hm.is_active = true
        on conflict (budget_month_id, owner_member_id) do nothing
      `,
      [householdId, budgetMonthId]
    );
  }

  private getNextYearMonth(year: number, month: number): { month: number; year: number } {
    if (month === 12) {
      return { month: 1, year: year + 1 };
    }

    return { month: month + 1, year };
  }

  private mapMonthOrThrow(row: BudgetMonthRow | undefined, message: string): BudgetMonthRecord {
    if (!row) {
      throw new NotFoundException(message);
    }

    return this.mapMonth(row);
  }

  private mapMonth(row: BudgetMonthRow): BudgetMonthRecord {
    return {
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      generatedAt: row.generated_at,
      householdId: row.household_id,
      id: row.id,
      isCurrent: row.is_current,
      month: row.month,
      sourceBudgetMonthId: row.source_budget_month_id,
      updatedAt: row.updated_at,
      year: row.year
    };
  }
}

interface BudgetMonthRow {
  archived_at: string | null;
  created_at: string;
  generated_at: string;
  household_id: string;
  id: string;
  is_current: boolean;
  month: number;
  source_budget_month_id: string | null;
  updated_at: string;
  year: number;
}

export interface BudgetMonthRecord {
  archivedAt: string | null;
  createdAt: string;
  generatedAt: string;
  householdId: string;
  id: string;
  isCurrent: boolean;
  month: number;
  sourceBudgetMonthId: string | null;
  updatedAt: string;
  year: number;
}

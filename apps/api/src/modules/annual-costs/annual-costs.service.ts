import { BadRequestException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CompleteAnnualCostDto,
  CreateAnnualCostDto,
  UpdateAnnualCostDto
} from './dto/annual-costs.dto';

@Injectable()
export class AnnualCostsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async listCosts(householdId: string): Promise<AnnualCostRecord[]> {
    const result = await this.database.query<AnnualCostRow>(
      `
        select id, household_id, name, default_amount, next_due_date, created_at, updated_at
        from annual_costs
        where household_id = $1
        order by next_due_date asc, name asc
      `,
      [householdId]
    );

    return result.rows.map((row) => this.mapCost(row));
  }

  async createCost(
    householdId: string,
    dto: CreateAnnualCostDto
  ): Promise<AnnualCostRecord> {
    const result = await this.database.query<AnnualCostRow>(
      `
        insert into annual_costs (
          household_id,
          name,
          default_amount,
          next_due_date
        )
        values ($1, $2, $3, $4)
        returning id, household_id, name, default_amount, next_due_date, created_at, updated_at
      `,
      [householdId, this.normalizeName(dto.name), dto.defaultAmount ?? null, dto.nextDueDate]
    );

    const cost = this.mapCostOrThrow(result.rows[0]);
    this.realtime.publish(householdId, 'annual_cost.changed', cost.id);

    return cost;
  }

  async updateCost(
    householdId: string,
    costId: string,
    dto: UpdateAnnualCostDto
  ): Promise<AnnualCostRecord | null> {
    if (
      dto.name === undefined &&
      dto.nextDueDate === undefined &&
      dto.defaultAmount === undefined
    ) {
      throw new BadRequestException('No annual cost fields to update');
    }

    const current = await this.findCost(householdId, costId);

    if (!current) {
      return null;
    }

    const result = await this.database.query<AnnualCostRow>(
      `
        update annual_costs
        set
          name = $3,
          default_amount = $4,
          next_due_date = $5
        where household_id = $1
          and id = $2
        returning id, household_id, name, default_amount, next_due_date, created_at, updated_at
      `,
      [
        householdId,
        costId,
        dto.name === undefined ? current.name : this.normalizeName(dto.name),
        dto.defaultAmount === undefined ? current.defaultAmount : dto.defaultAmount,
        dto.nextDueDate === undefined ? current.nextDueDate : dto.nextDueDate
      ]
    );

    const cost = result.rows[0] ? this.mapCost(result.rows[0]) : null;

    if (cost) {
      this.realtime.publish(householdId, 'annual_cost.changed', cost.id);
    }

    return cost;
  }

  async deleteCost(householdId: string, costId: string): Promise<boolean> {
    const result = await this.database.query(
      `
        delete from annual_costs
        where household_id = $1
          and id = $2
      `,
      [householdId, costId]
    );

    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, 'annual_cost.changed', costId);
    }

    return deleted;
  }

  async completeCost(
    householdId: string,
    costId: string,
    dto: CompleteAnnualCostDto
  ): Promise<AnnualCostCompletionRecord | null> {
    const completion = await this.database.transaction(async (client) => {
      const executedYear = Number(dto.executedAt.slice(0, 4));
      const existingHistory = await client.query<{ id: string }>(
        `
          select ach.id
          from annual_cost_history ach
          join annual_costs ac on ac.id = ach.annual_cost_id
          where ac.household_id = $1
            and ach.annual_cost_id = $2
            and ach.executed_at >= make_date($3::integer, 1, 1)
            and ach.executed_at < make_date(($3::integer + 1), 1, 1)
          limit 1
        `,
        [householdId, costId, executedYear]
      );

      if (existingHistory.rows[0]) {
        throw new BadRequestException('Annual cost already completed for this year');
      }

      const cost = await this.updateNextDueDate(client, householdId, costId, dto.executedAt);

      if (!cost) {
        return null;
      }

      const historyResult = await client.query<AnnualCostHistoryRow>(
        `
          insert into annual_cost_history (
            annual_cost_id,
            executed_at,
            amount
          )
          select ac.id, $3, $4
          from annual_costs ac
          where ac.household_id = $1
            and ac.id = $2
          returning id, annual_cost_id, executed_at, amount, created_at
        `,
        [householdId, costId, dto.executedAt, dto.amount ?? null]
      );

      return {
        cost,
        history: this.mapHistoryOrThrow(historyResult.rows[0], cost.name)
      };
    });

    if (completion) {
      this.realtime.publish(householdId, 'annual_cost.changed', completion.cost.id);
    }

    return completion;
  }

  async listHistory(
    householdId: string,
    year: number
  ): Promise<AnnualCostHistoryRecord[]> {
    const result = await this.database.query<AnnualCostHistoryWithNameRow>(
      `
        select
          ach.id,
          ach.annual_cost_id,
          ac.name as annual_cost_name,
          ach.executed_at,
          ach.amount,
          ach.created_at
        from annual_cost_history ach
        join annual_costs ac on ac.id = ach.annual_cost_id
        where ac.household_id = $1
          and ach.executed_at >= make_date($2::integer, 1, 1)
          and ach.executed_at < make_date(($2::integer + 1), 1, 1)
        order by ach.executed_at desc, ac.name asc
      `,
      [householdId, year]
    );

    return result.rows.map((row) => this.mapHistory(row, row.annual_cost_name));
  }

  private async findCost(
    householdId: string,
    costId: string
  ): Promise<AnnualCostRecord | null> {
    const result = await this.database.query<AnnualCostRow>(
      `
        select id, household_id, name, default_amount, next_due_date, created_at, updated_at
        from annual_costs
        where household_id = $1
          and id = $2
        limit 1
      `,
      [householdId, costId]
    );

    return result.rows[0] ? this.mapCost(result.rows[0]) : null;
  }

  private async updateNextDueDate(
    client: PoolClient,
    householdId: string,
    costId: string,
    executedAt: string
  ): Promise<AnnualCostRecord | null> {
    const result = await client.query<AnnualCostRow>(
      `
        update annual_costs
        set next_due_date = ($3::date + interval '1 year')::date
        where household_id = $1
          and id = $2
        returning id, household_id, name, default_amount, next_due_date, created_at, updated_at
      `,
      [householdId, costId, executedAt]
    );

    return result.rows[0] ? this.mapCost(result.rows[0]) : null;
  }

  private normalizeName(name: string): string {
    const normalized = name.trim();

    if (!normalized) {
      throw new BadRequestException('Annual cost name is required');
    }

    return normalized;
  }

  private mapCostOrThrow(row: AnnualCostRow | undefined): AnnualCostRecord {
    if (!row) {
      throw new Error('Expected annual cost record');
    }

    return this.mapCost(row);
  }

  private mapCost(row: AnnualCostRow): AnnualCostRecord {
    return {
      createdAt: row.created_at,
      defaultAmount: row.default_amount,
      householdId: row.household_id,
      id: row.id,
      name: row.name,
      nextDueDate: this.formatDateOnly(row.next_due_date),
      updatedAt: row.updated_at
    };
  }

  private mapHistoryOrThrow(
    row: AnnualCostHistoryRow | undefined,
    annualCostName: string
  ): AnnualCostHistoryRecord {
    if (!row) {
      throw new Error('Expected annual cost history record');
    }

    return this.mapHistory(row, annualCostName);
  }

  private mapHistory(
    row: AnnualCostHistoryRow,
    annualCostName: string
  ): AnnualCostHistoryRecord {
    return {
      amount: row.amount,
      annualCostId: row.annual_cost_id,
      annualCostName,
      createdAt: row.created_at,
      executedAt: this.formatDateOnly(row.executed_at),
      id: row.id
    };
  }

  private formatDateOnly(value: Date | string): string {
    if (typeof value === 'string') {
      return value.slice(0, 10);
    }

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}

interface AnnualCostRow {
  created_at: string;
  default_amount: string | null;
  household_id: string;
  id: string;
  name: string;
  next_due_date: Date | string;
  updated_at: string;
}

interface AnnualCostHistoryRow {
  amount: string | null;
  annual_cost_id: string;
  created_at: string;
  executed_at: Date | string;
  id: string;
}

interface AnnualCostHistoryWithNameRow extends AnnualCostHistoryRow {
  annual_cost_name: string;
}

export interface AnnualCostRecord {
  createdAt: string;
  defaultAmount: string | null;
  householdId: string;
  id: string;
  name: string;
  nextDueDate: string;
  updatedAt: string;
}

export interface AnnualCostHistoryRecord {
  amount: string | null;
  annualCostId: string;
  annualCostName: string;
  createdAt: string;
  executedAt: string;
  id: string;
}

export interface AnnualCostCompletionRecord {
  cost: AnnualCostRecord;
  history: AnnualCostHistoryRecord;
}

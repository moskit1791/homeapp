import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CopyMealPlanDto,
  CreateMealIdeaDto,
  CreateMealPlanDto,
  MealPlanEntryDto,
  MealPlanEntryTargetDto,
  RandomizeMealPlanDto,
  UpdateMealIdeaDto,
  UpdateMealPlanDto
} from './dto/meal-planner.dto';

@Injectable()
export class MealPlannerService {
  private static readonly RANDOMIZE_EXCLUDED_WEEKS = 3;

  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async getCurrentPlan(householdId: string): Promise<MealPlanDetail | null> {
    const currentWeekStartDate = await this.getCurrentWeekStartDate();
    const plan = await this.findPlanByWeekStartDate(householdId, currentWeekStartDate);

    if (!plan) {
      return null;
    }

    return this.getPlanDetail(householdId, plan.id);
  }

  async getPlan(householdId: string, mealPlanId: string): Promise<MealPlanDetail | null> {
    const plan = await this.findPlan(householdId, mealPlanId);

    if (!plan) {
      return null;
    }

    return this.getPlanDetail(householdId, plan.id);
  }

  async listHistory(householdId: string): Promise<MealPlanSummary[]> {
    const result = await this.database.query<MealPlanSummaryRow>(
      `
        select
          mpw.id,
          mpw.household_id,
          mpw.week_start_date,
          count(mpe.id)::integer as entries_count,
          mpw.created_at,
          mpw.updated_at
        from meal_plan_weeks mpw
        left join meal_plan_entries mpe on mpe.meal_plan_week_id = mpw.id
        where mpw.household_id = $1
        group by mpw.id
        order by mpw.week_start_date desc
      `,
      [householdId]
    );

    return result.rows.map((row) => ({
      createdAt: row.created_at,
      entriesCount: row.entries_count,
      householdId: row.household_id,
      id: row.id,
      updatedAt: row.updated_at,
      weekStartDate: this.formatDateOnly(row.week_start_date)
    }));
  }

  async createPlan(householdId: string, dto: CreateMealPlanDto): Promise<MealPlanDetail> {
    this.ensureMonday(dto.weekStartDate);
    const result = await this.database.query<MealPlanWeekRow>(
      `
        insert into meal_plan_weeks (
          household_id,
          week_start_date
        )
        values ($1, $2)
        on conflict (household_id, week_start_date) do nothing
        returning id, household_id, week_start_date, created_at, updated_at
      `,
      [householdId, dto.weekStartDate]
    );
    const row = result.rows[0];

    if (!row) {
      throw new BadRequestException('Meal plan week already exists');
    }

    const plan = {
      entries: [],
      week: this.mapWeek(row)
    };
    this.realtime.publish(householdId, 'meal.changed', plan.week.id);

    return plan;
  }

  async updatePlan(
    householdId: string,
    mealPlanId: string,
    dto: UpdateMealPlanDto
  ): Promise<MealPlanDetail | null> {
    const plan = await this.findPlan(householdId, mealPlanId);

    if (!plan) {
      return null;
    }

    await this.validateEntries(householdId, dto.entries);
    await this.database.transaction(async (client) => {
      for (const entry of dto.entries) {
        await client.query(
          `
            insert into meal_plan_entries (
              meal_plan_week_id,
              weekday,
              slot_index,
              meal_name,
              link_url,
              note
            )
            values ($1, $2, $3, $4, $5, $6)
            on conflict (meal_plan_week_id, weekday, slot_index) do update
            set
              meal_name = excluded.meal_name,
              link_url = excluded.link_url,
              note = excluded.note
          `,
          [
            plan.id,
            entry.weekday,
            entry.slotIndex,
            this.normalizeText(entry.mealName, 'Meal name'),
            this.normalizeOptionalText(entry.linkUrl),
            this.normalizeOptionalText(entry.note)
          ]
        );
      }
    });

    const updated = await this.getPlanDetail(householdId, mealPlanId);
    this.realtime.publish(householdId, 'meal.changed', mealPlanId);

    return updated;
  }

  async copyPlan(
    householdId: string,
    sourcePlanId: string,
    dto: CopyMealPlanDto
  ): Promise<MealPlanDetail | null> {
    this.ensureMonday(dto.targetWeekStartDate);

    const source = await this.findPlan(householdId, sourcePlanId);

    if (!source) {
      return null;
    }

    const targetId = await this.database.transaction(async (client) => {
      const targetResult = await client.query<{ id: string }>(
        `
          insert into meal_plan_weeks (
            household_id,
            week_start_date
          )
          values ($1, $2)
          on conflict (household_id, week_start_date) do update
          set week_start_date = excluded.week_start_date
          returning id
        `,
        [householdId, dto.targetWeekStartDate]
      );
      const target = targetResult.rows[0];

      if (!target) {
        throw new Error('Expected target meal plan');
      }

      await client.query(
        `
          delete from meal_plan_entries
          where meal_plan_week_id = $1
        `,
        [target.id]
      );
      await client.query(
        `
          insert into meal_plan_entries (
            meal_plan_week_id,
            weekday,
            slot_index,
            meal_name,
            link_url,
            note
          )
          select
            $2,
            weekday,
            slot_index,
            meal_name,
            link_url,
            note
          from meal_plan_entries
          where meal_plan_week_id = $1
        `,
        [source.id, target.id]
      );

      return target.id;
    });

    const copied = await this.getPlanDetail(householdId, targetId);
    this.realtime.publish(householdId, 'meal.changed', targetId);

    return copied;
  }

  async deletePlan(householdId: string, mealPlanId: string): Promise<boolean> {
    const result = await this.database.query(
      `
        delete from meal_plan_weeks
        where household_id = $1
          and id = $2
      `,
      [householdId, mealPlanId]
    );

    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, 'meal.changed', mealPlanId);
    }

    return deleted;
  }

  async deletePlanEntry(
    householdId: string,
    mealPlanId: string,
    dto: MealPlanEntryTargetDto
  ): Promise<MealPlanDetail | null> {
    const plan = await this.findPlan(householdId, mealPlanId);

    if (!plan) {
      return null;
    }

    await this.database.query(
      `
        delete from meal_plan_entries
        where meal_plan_week_id = $1
          and weekday = $2
          and slot_index = $3
      `,
      [mealPlanId, dto.weekday, dto.slotIndex]
    );

    const updated = await this.getPlanDetail(householdId, mealPlanId);
    this.realtime.publish(householdId, 'meal.changed', mealPlanId);

    return updated;
  }

  async randomize(householdId: string, dto: RandomizeMealPlanDto): Promise<MealRandomizeResult> {
    const targetWeekStartDate = dto.targetWeekStartDate ?? (await this.getCurrentWeekStartDate());
    this.ensureMonday(targetWeekStartDate);

    if (
      (dto.weekday === undefined && dto.slotIndex !== undefined) ||
      (dto.weekday !== undefined && dto.slotIndex === undefined)
    ) {
      throw new BadRequestException('weekday and slotIndex must be provided together');
    }

    if (dto.weekday !== undefined && dto.slotIndex !== undefined) {
      await this.validateEntries(householdId, [
        {
          mealName: 'placeholder',
          slotIndex: dto.slotIndex,
          weekday: dto.weekday
        }
      ]);
    }

    const mealSlotsPerDay = await this.getMealSlotsPerDay(householdId);
    const candidates = await this.listRandomizeCandidates(householdId, targetWeekStartDate, dto);
    const suggestions = this.pickSuggestions(candidates, mealSlotsPerDay, dto);

    return {
      excludedRecentWeeks: MealPlannerService.RANDOMIZE_EXCLUDED_WEEKS,
      suggestions,
      targetWeekStartDate
    };
  }

  async listIdeas(householdId: string): Promise<MealIdeaRecord[]> {
    const result = await this.database.query<MealIdeaRow>(
      `
        select id, household_id, title, note, link_url, created_at, updated_at
        from meal_ideas
        where household_id = $1
        order by updated_at desc, title asc
      `,
      [householdId]
    );

    return result.rows.map((row) => this.mapIdea(row));
  }

  async createIdea(householdId: string, dto: CreateMealIdeaDto): Promise<MealIdeaRecord> {
    const result = await this.database.query<MealIdeaRow>(
      `
        insert into meal_ideas (
          household_id,
          title,
          note,
          link_url
        )
        values ($1, $2, $3, $4)
        returning id, household_id, title, note, link_url, created_at, updated_at
      `,
      [
        householdId,
        this.normalizeText(dto.title, 'Meal idea title'),
        this.normalizeOptionalText(dto.note),
        this.normalizeOptionalText(dto.linkUrl)
      ]
    );

    const idea = this.mapIdeaOrThrow(result.rows[0]);
    this.realtime.publish(householdId, 'meal.changed', idea.id);

    return idea;
  }

  async updateIdea(
    householdId: string,
    ideaId: string,
    dto: UpdateMealIdeaDto
  ): Promise<MealIdeaRecord | null> {
    if (dto.title === undefined && dto.note === undefined && dto.linkUrl === undefined) {
      throw new BadRequestException('No meal idea fields to update');
    }

    const current = await this.findIdea(householdId, ideaId);

    if (!current) {
      return null;
    }

    const result = await this.database.query<MealIdeaRow>(
      `
        update meal_ideas
        set
          title = $3,
          note = $4,
          link_url = $5
        where household_id = $1
          and id = $2
        returning id, household_id, title, note, link_url, created_at, updated_at
      `,
      [
        householdId,
        ideaId,
        dto.title === undefined ? current.title : this.normalizeText(dto.title, 'Meal idea title'),
        dto.note === undefined ? current.note : this.normalizeOptionalText(dto.note),
        dto.linkUrl === undefined ? current.linkUrl : this.normalizeOptionalText(dto.linkUrl)
      ]
    );

    const idea = result.rows[0] ? this.mapIdea(result.rows[0]) : null;

    if (idea) {
      this.realtime.publish(householdId, 'meal.changed', idea.id);
    }

    return idea;
  }

  async deleteIdea(householdId: string, ideaId: string): Promise<boolean> {
    const result = await this.database.query(
      `
        delete from meal_ideas
        where household_id = $1
          and id = $2
      `,
      [householdId, ideaId]
    );

    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, 'meal.changed', ideaId);
    }

    return deleted;
  }

  private async getPlanDetail(
    householdId: string,
    mealPlanId: string
  ): Promise<MealPlanDetail> {
    const plan = await this.findPlan(householdId, mealPlanId);

    if (!plan) {
      throw new BadRequestException('Meal plan not found');
    }

    const entries = await this.listEntries(plan.id);

    return {
      entries,
      week: plan
    };
  }

  private async findPlan(
    householdId: string,
    mealPlanId: string
  ): Promise<MealPlanWeekRecord | null> {
    const result = await this.database.query<MealPlanWeekRow>(
      `
        select id, household_id, week_start_date, created_at, updated_at
        from meal_plan_weeks
        where household_id = $1
          and id = $2
        limit 1
      `,
      [householdId, mealPlanId]
    );

    return result.rows[0] ? this.mapWeek(result.rows[0]) : null;
  }

  private async findPlanByWeekStartDate(
    householdId: string,
    weekStartDate: string
  ): Promise<MealPlanWeekRecord | null> {
    const result = await this.database.query<MealPlanWeekRow>(
      `
        select id, household_id, week_start_date, created_at, updated_at
        from meal_plan_weeks
        where household_id = $1
          and week_start_date = $2
        limit 1
      `,
      [householdId, weekStartDate]
    );

    return result.rows[0] ? this.mapWeek(result.rows[0]) : null;
  }

  private async listEntries(mealPlanId: string): Promise<MealPlanEntryRecord[]> {
    const result = await this.database.query<MealPlanEntryRow>(
      `
        select
          id,
          meal_plan_week_id,
          weekday,
          slot_index,
          meal_name,
          link_url,
          note,
          created_at,
          updated_at
        from meal_plan_entries
        where meal_plan_week_id = $1
        order by weekday asc, slot_index asc
      `,
      [mealPlanId]
    );

    return result.rows.map((row) => this.mapEntry(row));
  }

  private async getMealSlotsPerDay(householdId: string): Promise<number> {
    const result = await this.database.query<{ meal_slots_per_day: number }>(
      `
        select meal_slots_per_day
        from households
        where id = $1
        limit 1
      `,
      [householdId]
    );
    const row = result.rows[0];

    if (!row) {
      throw new BadRequestException('Household not found');
    }

    return row.meal_slots_per_day;
  }

  private async validateEntries(householdId: string, entries: MealPlanEntryDto[]): Promise<void> {
    const mealSlotsPerDay = await this.getMealSlotsPerDay(householdId);

    for (const entry of entries) {
      if (entry.slotIndex >= mealSlotsPerDay) {
        throw new BadRequestException('Meal slot index exceeds household meal slots per day');
      }
    }
  }

  private async listRandomizeCandidates(
    householdId: string,
    targetWeekStartDate: string,
    dto: RandomizeMealPlanDto
  ): Promise<MealRandomizeCandidate[]> {
    const values: unknown[] = [
      householdId,
      targetWeekStartDate,
      MealPlannerService.RANDOMIZE_EXCLUDED_WEEKS
    ];
    const filters: string[] = [];

    if (dto.weekday !== undefined && dto.slotIndex !== undefined) {
      values.push(dto.weekday, dto.slotIndex);
      filters.push(`and mpe.weekday = $4 and mpe.slot_index = $5`);
    }

    const result = await this.database.query<MealRandomizeCandidateRow>(
      `
        select distinct on (mpe.weekday, mpe.slot_index, lower(mpe.meal_name))
          mpe.weekday,
          mpe.slot_index,
          mpe.meal_name,
          mpe.link_url,
          mpe.note,
          mpw.week_start_date
        from meal_plan_entries mpe
        join meal_plan_weeks mpw on mpw.id = mpe.meal_plan_week_id
        where mpw.household_id = $1
          and mpw.week_start_date < ($2::date - ($3::integer * interval '7 days'))
          ${filters.join('\n')}
        order by
          mpe.weekday,
          mpe.slot_index,
          lower(mpe.meal_name),
          mpw.week_start_date desc
      `,
      values
    );

    return result.rows.map((row) => ({
      linkUrl: row.link_url,
      mealName: row.meal_name,
      note: row.note,
      slotIndex: row.slot_index,
      sourceWeekStartDate: this.formatDateOnly(row.week_start_date),
      weekday: row.weekday
    }));
  }

  private pickSuggestions(
    candidates: MealRandomizeCandidate[],
    mealSlotsPerDay: number,
    dto: RandomizeMealPlanDto
  ): MealRandomizeSuggestion[] {
    if (dto.weekday !== undefined && dto.slotIndex !== undefined) {
      const candidate = this.pickOne(candidates);
      return candidate ? [candidate] : [];
    }

    const suggestions: MealRandomizeSuggestion[] = [];

    for (let weekday = 1; weekday <= 7; weekday += 1) {
      for (let slotIndex = 0; slotIndex < mealSlotsPerDay; slotIndex += 1) {
        const slotCandidates = candidates.filter(
          (candidate) => candidate.weekday === weekday && candidate.slotIndex === slotIndex
        );
        const picked = this.pickOne(slotCandidates);

        if (picked) {
          suggestions.push(picked);
        }
      }
    }

    return suggestions;
  }

  private pickOne<T>(items: T[]): T | null {
    if (items.length === 0) {
      return null;
    }

    return items[Math.floor(Math.random() * items.length)] ?? null;
  }

  private async getCurrentWeekStartDate(): Promise<string> {
    const result = await this.database.query<{ week_start_date: string }>(
      `
        select (
          current_date - ((extract(isodow from current_date)::integer - 1) * interval '1 day')
        )::date::text as week_start_date
      `
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error('Expected current week start date');
    }

    return row.week_start_date;
  }

  private ensureMonday(date: string): void {
    const parsed = new Date(`${date}T00:00:00.000Z`);

    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('Invalid week start date');
    }

    if (parsed.getUTCDay() !== 1) {
      throw new BadRequestException('Meal plan week must start on Monday');
    }
  }

  private async findIdea(
    householdId: string,
    ideaId: string
  ): Promise<MealIdeaRecord | null> {
    const result = await this.database.query<MealIdeaRow>(
      `
        select id, household_id, title, note, link_url, created_at, updated_at
        from meal_ideas
        where household_id = $1
          and id = $2
        limit 1
      `,
      [householdId, ideaId]
    );

    return result.rows[0] ? this.mapIdea(result.rows[0]) : null;
  }

  private normalizeText(value: string, label: string): string {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException(`${label} is required`);
    }

    return normalized;
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();

    return normalized ? normalized : null;
  }

  private mapWeek(row: MealPlanWeekRow): MealPlanWeekRecord {
    return {
      createdAt: row.created_at,
      householdId: row.household_id,
      id: row.id,
      updatedAt: row.updated_at,
      weekStartDate: this.formatDateOnly(row.week_start_date)
    };
  }

  private mapEntry(row: MealPlanEntryRow): MealPlanEntryRecord {
    return {
      createdAt: row.created_at,
      id: row.id,
      linkUrl: row.link_url,
      mealName: row.meal_name,
      mealPlanWeekId: row.meal_plan_week_id,
      note: row.note,
      slotIndex: row.slot_index,
      updatedAt: row.updated_at,
      weekday: row.weekday
    };
  }

  private mapIdeaOrThrow(row: MealIdeaRow | undefined): MealIdeaRecord {
    if (!row) {
      throw new Error('Expected meal idea record');
    }

    return this.mapIdea(row);
  }

  private mapIdea(row: MealIdeaRow): MealIdeaRecord {
    return {
      createdAt: row.created_at,
      householdId: row.household_id,
      id: row.id,
      linkUrl: row.link_url,
      note: row.note,
      title: row.title,
      updatedAt: row.updated_at
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

interface MealPlanWeekRow {
  created_at: string;
  household_id: string;
  id: string;
  updated_at: string;
  week_start_date: Date | string;
}

interface MealPlanSummaryRow extends MealPlanWeekRow {
  entries_count: number;
}

interface MealPlanEntryRow {
  created_at: string;
  id: string;
  link_url: string | null;
  meal_name: string;
  meal_plan_week_id: string;
  note: string | null;
  slot_index: number;
  updated_at: string;
  weekday: number;
}

interface MealIdeaRow {
  created_at: string;
  household_id: string;
  id: string;
  link_url: string | null;
  note: string | null;
  title: string;
  updated_at: string;
}

interface MealRandomizeCandidateRow {
  link_url: string | null;
  meal_name: string;
  note: string | null;
  slot_index: number;
  week_start_date: Date | string;
  weekday: number;
}

export interface MealPlanWeekRecord {
  createdAt: string;
  householdId: string;
  id: string;
  updatedAt: string;
  weekStartDate: string;
}

export interface MealPlanSummary extends MealPlanWeekRecord {
  entriesCount: number;
}

export interface MealPlanEntryRecord {
  createdAt: string;
  id: string;
  linkUrl: string | null;
  mealName: string;
  mealPlanWeekId: string;
  note: string | null;
  slotIndex: number;
  updatedAt: string;
  weekday: number;
}

export interface MealPlanDetail {
  entries: MealPlanEntryRecord[];
  week: MealPlanWeekRecord;
}

export interface MealIdeaRecord {
  createdAt: string;
  householdId: string;
  id: string;
  linkUrl: string | null;
  note: string | null;
  title: string;
  updatedAt: string;
}

export interface MealRandomizeSuggestion {
  linkUrl: string | null;
  mealName: string;
  note: string | null;
  slotIndex: number;
  sourceWeekStartDate: string;
  weekday: number;
}

export type MealRandomizeCandidate = MealRandomizeSuggestion;

export interface MealRandomizeResult {
  excludedRecentWeeks: number;
  suggestions: MealRandomizeSuggestion[];
  targetWeekStartDate: string;
}

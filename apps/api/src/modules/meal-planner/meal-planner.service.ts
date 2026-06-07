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
          coalesce(total_counts.entries_count, 0)::integer as entries_count,
          coalesce(
            jsonb_object_agg(day_counts.weekday, day_counts.entries_count)
              filter (where day_counts.weekday is not null),
            '{}'::jsonb
          ) as entries_by_weekday,
          mpw.created_at,
          mpw.updated_at
        from meal_plan_weeks mpw
        left join (
          select
            meal_plan_week_id,
            count(*)::integer as entries_count
          from meal_plan_entries
          group by meal_plan_week_id
        ) total_counts on total_counts.meal_plan_week_id = mpw.id
        left join (
          select
            meal_plan_week_id,
            weekday,
            count(*)::integer as entries_count
          from meal_plan_entries
          group by meal_plan_week_id, weekday
        ) day_counts on day_counts.meal_plan_week_id = mpw.id
        where mpw.household_id = $1
        group by mpw.id, total_counts.entries_count
        order by mpw.week_start_date desc
      `,
      [householdId]
    );

    return result.rows.map((row) => ({
      createdAt: row.created_at,
      entriesByWeekday: this.normalizeEntriesByWeekday(row.entries_by_weekday),
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
          delete from meal_plan_entries mpe
          using meal_plan_weeks mpw
          where mpw.id = mpe.meal_plan_week_id
            and mpw.household_id = $1
            and mpe.meal_plan_week_id = $2
        `,
        [householdId, target.id]
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
            $3,
            mpe.weekday,
            mpe.slot_index,
            mpe.meal_name,
            mpe.link_url,
            mpe.note
          from meal_plan_entries mpe
          join meal_plan_weeks mpw on mpw.id = mpe.meal_plan_week_id
          where mpw.household_id = $1
            and mpe.meal_plan_week_id = $2
        `,
        [householdId, source.id, target.id]
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
        delete from meal_plan_entries mpe
        using meal_plan_weeks mpw
        where mpw.id = mpe.meal_plan_week_id
          and mpw.household_id = $1
          and mpe.meal_plan_week_id = $2
          and mpe.weekday = $3
          and mpe.slot_index = $4
      `,
      [householdId, mealPlanId, dto.weekday, dto.slotIndex]
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

    const entries = await this.listEntries(householdId, plan.id);

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

  private async listEntries(
    householdId: string,
    mealPlanId: string
  ): Promise<MealPlanEntryRecord[]> {
    const result = await this.database.query<MealPlanEntryRow>(
      `
        select
          mpe.id,
          mpe.meal_plan_week_id,
          mpe.weekday,
          mpe.slot_index,
          mpe.meal_name,
          mpe.link_url,
          mpe.note,
          mpe.created_at,
          mpe.updated_at
        from meal_plan_entries mpe
        join meal_plan_weeks mpw on mpw.id = mpe.meal_plan_week_id
        where mpw.household_id = $1
          and mpe.meal_plan_week_id = $2
        order by mpe.weekday asc, mpe.slot_index asc
      `,
      [householdId, mealPlanId]
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

  private normalizeEntriesByWeekday(value: unknown): Record<number, number> {
    if (!value || typeof value !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value)
        .map(([weekday, count]) => [Number(weekday), Number(count)] as const)
        .filter(([weekday, count]) => weekday >= 1 && weekday <= 7 && count > 0)
    );
  }

  async generateAiPrompt(householdId: string): Promise<{ prompt: string }> {
    const mealSlotsPerDay = await this.getMealSlotsPerDay(householdId);

    const historyResult = await this.database.query<MealPromptHistoryRow>(
      `
        select
          mpe.meal_name,
          mpe.link_url,
          mpe.note,
          mpe.weekday,
          mpe.slot_index,
          mpw.week_start_date,
          (mpw.week_start_date + ((mpe.weekday - 1) * interval '1 day'))::date as served_on
        from meal_plan_entries mpe
        join meal_plan_weeks mpw on mpw.id = mpe.meal_plan_week_id
        where mpw.household_id = $1
          and btrim(mpe.meal_name) <> ''
          and (mpw.week_start_date + ((mpe.weekday - 1) * interval '1 day'))::date <= current_date
        order by served_on desc, mpe.weekday asc, mpe.slot_index asc
        limit 1500
      `,
      [householdId]
    );

    const history = historyResult.rows.map((row): MealPromptHistoryEntry => ({
      linkUrl: row.link_url,
      mealName: row.meal_name,
      note: row.note,
      servedOn: this.formatDateOnly(row.served_on),
      slotIndex: row.slot_index,
      sourceHint: inferMealPromptSource(row.meal_name, row.note),
      weekday: row.weekday,
      weekStartDate: this.formatDateOnly(row.week_start_date)
    }));
    const prompt = buildMealAiCopyPrompt({
      history,
      mealSlotsPerDay
    });

    return { prompt };
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
  entries_by_weekday: Record<string, number> | null;
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
  entriesByWeekday: Record<number, number>;
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

function buildMealAiCopyPrompt(input: {
  history: MealPromptHistoryEntry[];
  mealSlotsPerDay: number;
}): string {
  const payload = buildMealPromptPayload(input.history, input.mealSlotsPerDay);

  return [
    'Jestes AI pomagajacym ukladac jedzenie dla konkretnego domu.',
    'To jest prompt uniwersalny: nie zakladaj, ze kazdy dom je tak samo. Styl domu wywnioskuj z danych historycznych doklejonych na koncu.',
    '',
    'Cel:',
    `- Przygotuj propozycje planu jedzenia na tydzien ${payload.summary.suggestedTargetWeekStartDate ?? 'nastepny po ostatnim tygodniu z historii'}.`,
    `- Dom ma ${input.mealSlotsPerDay} sloty posilkow dziennie. Sloty sa zapisane jako slotIndex 0..${Math.max(input.mealSlotsPerDay - 1, 0)}, ale w odpowiedzi pokazuj je jako Posilek 1..${input.mealSlotsPerDay}.`,
    '- Najpierw podaj krotkie wnioski z historii, potem plan tygodnia.',
    '',
    'Jak analizowac dom:',
    '- Najpierw rozpoznaj, co oznacza kazdy slot. Nie zakladaj z gory, ze slot 0 zawsze jest sniadaniem, a slot 1 obiadem; potwierdz to historia. Jesli profil slotu jest mieszany, napisz to i dobierz ostroznie.',
    '- Oddziel wzorce slotow: sniadania nie mieszaj z obiadami, obiadami nie z dodatkowymi zupami/kolacjami, chyba ze historia pokazuje taki sposob uzycia.',
    '- Zlap rytm dni tygodnia: poniedzialki, wtorki itd. moga miec inne stale posilki niz weekend.',
    '- Rozpoznaj posilki powtarzalne przez kilka dni, resztki, wyjazdy, prace, rodzinne obiady i jedzenie poza domem. Nie zamieniaj kontekstu typu "praca", "knajpa", "Sanok" w przepis, jesli to raczej informacja organizacyjna.',
    '- Historia jest modelem preferencji, nie lista do bezmyslnego kopiowania. Mieszaj sprawdzone ulubione dania z podobnymi nowymi propozycjami.',
    '- Nie proponuj bardzo podobnych posilkow z ostatnich 30 dni historii, chyba ze historia pokazuje celowe powtarzanie albo uzytkownik o to prosi.',
    '- Dbaj o praktycznosc: czesc dan moze sie powtarzac jako resztki, ciezsze gotowanie dawaj wtedy, gdy historia domu zwykle je znosi, a szybkie posilki tam, gdzie dom je czesto stosuje.',
    '- Zwracaj uwage na zrodla i skroty: C/Cookidoo, KS/Kwestia Smaku, AG/AniaGotuje, IG/Instagram, Knorr, MW/Moje Wypieki, Rozkoszny. Jesli proponujesz linki, dawaj tylko realne URL-e do konkretnych przepisow; nie wymyslaj adresow.',
    '- Jesli w historii brakuje linkow, nadal mozesz zaproponowac posilki bez linku i oznaczyc preferowane zrodlo.',
    '',
    'Format odpowiedzi:',
    '1. "Wnioski z historii" - maksymalnie 8 punktow: sloty, dni tygodnia, ulubione typy dan, zrodla, ostatnio jedzone rzeczy do omijania.',
    '2. "Plan tygodnia" - tabela: dzien, Posilek 1, Posilek 2, Posilek 3... wedlug liczby slotow domu.',
    '3. Przy kazdej mniej oczywistej propozycji dodaj bardzo krotkie uzasadnienie w nawiasie, np. "pasuje do piatkowych tortilli" albo "alternatywa do Cookidoo".',
    '4. Na koncu wypisz "Nie dawaj teraz ponownie" z najwazniejszymi posilkami z ostatnich 30 dni historii.',
    '',
    'DANE DOMU I HISTORIA (JSON do analizy):',
    JSON.stringify(payload, null, 2)
  ].join('\n');
}

function buildMealPromptPayload(
  history: MealPromptHistoryEntry[],
  mealSlotsPerDay: number
) {
  const weekDates = [...new Set(history.map((entry) => entry.weekStartDate))].sort();
  const servedDates = [...new Set(history.map((entry) => entry.servedOn))].sort();
  const firstServedOn = servedDates[0] ?? null;
  const lastServedOn = servedDates[servedDates.length - 1] ?? null;
  const latestWeekStartDate = weekDates[weekDates.length - 1] ?? null;

  return {
    summary: {
      entriesCount: history.length,
      firstServedOn,
      lastServedOn,
      latestWeekStartDate,
      mealSlotsPerDay,
      suggestedTargetWeekStartDate: addDateDays(latestWeekStartDate, 7),
      weeksCount: weekDates.length
    },
    sourcePreferences: buildMealPromptSourcePreferences(history),
    slotProfiles: buildMealPromptSlotProfiles(history, mealSlotsPerDay),
    weekdaySlotPatterns: buildMealPromptWeekdaySlotPatterns(history, mealSlotsPerDay),
    frequentMeals: buildMealPromptFrequency(history).slice(0, 120),
    recentMealsLast30Days: buildRecentMealPromptEntries(history, lastServedOn).slice(0, 120),
    recentWeeks: buildRecentMealPromptWeeks(history, 12)
  };
}

function buildMealPromptSourcePreferences(history: MealPromptHistoryEntry[]) {
  const counts = new Map<string, number>();

  for (const entry of history) {
    if (!entry.sourceHint) {
      continue;
    }

    counts.set(entry.sourceHint, (counts.get(entry.sourceHint) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([source, count]) => ({ count, source }))
    .sort((left, right) => right.count - left.count || left.source.localeCompare(right.source));
}

function buildMealPromptSlotProfiles(
  history: MealPromptHistoryEntry[],
  mealSlotsPerDay: number
) {
  return Array.from({ length: mealSlotsPerDay }, (_, slotIndex) => {
    const entries = history.filter((entry) => entry.slotIndex === slotIndex);
    const breakfastLikeCount = entries.filter((entry) => isBreakfastLike(entry.mealName)).length;
    const mainMealLikeCount = entries.filter((entry) => isMainMealLike(entry.mealName)).length;
    const count = entries.length;

    return {
      breakfastLikeCount,
      count,
      detectedRole: detectSlotRole(count, breakfastLikeCount, mainMealLikeCount),
      mainMealLikeCount,
      slotIndex,
      topMeals: buildMealPromptFrequency(entries).slice(0, 15)
    };
  });
}

function buildMealPromptWeekdaySlotPatterns(
  history: MealPromptHistoryEntry[],
  mealSlotsPerDay: number
) {
  const patterns: Array<{
    observedCount: number;
    slotIndex: number;
    topMeals: MealPromptFrequency[];
    weekday: number;
    weekdayName: string;
  }> = [];

  for (let weekday = 1; weekday <= 7; weekday += 1) {
    for (let slotIndex = 0; slotIndex < mealSlotsPerDay; slotIndex += 1) {
      const entries = history.filter(
        (entry) => entry.weekday === weekday && entry.slotIndex === slotIndex
      );

      patterns.push({
        observedCount: entries.length,
        slotIndex,
        topMeals: buildMealPromptFrequency(entries).slice(0, 7),
        weekday,
        weekdayName: getWeekdayName(weekday)
      });
    }
  }

  return patterns;
}

function buildMealPromptFrequency(history: MealPromptHistoryEntry[]): MealPromptFrequency[] {
  const groups = new Map<string, MealPromptFrequency>();

  for (const entry of history) {
    const key = normalizeMealPromptText(entry.mealName);

    if (!key) {
      continue;
    }

    const current = groups.get(key);

    if (!current) {
      groups.set(key, {
        count: 1,
        lastServedOn: entry.servedOn,
        mealName: entry.mealName,
        slotIndexes: [entry.slotIndex],
        sourceHints: entry.sourceHint ? [entry.sourceHint] : [],
        weekdays: [entry.weekday]
      });
      continue;
    }

    current.count += 1;
    current.lastServedOn = current.lastServedOn > entry.servedOn
      ? current.lastServedOn
      : entry.servedOn;

    if (!current.weekdays.includes(entry.weekday)) {
      current.weekdays.push(entry.weekday);
    }

    if (!current.slotIndexes.includes(entry.slotIndex)) {
      current.slotIndexes.push(entry.slotIndex);
    }

    if (entry.sourceHint && !current.sourceHints.includes(entry.sourceHint)) {
      current.sourceHints.push(entry.sourceHint);
    }
  }

  return [...groups.values()]
    .map((item) => ({
      ...item,
      slotIndexes: item.slotIndexes.sort((left, right) => left - right),
      sourceHints: item.sourceHints.sort(),
      weekdays: item.weekdays.sort((left, right) => left - right)
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        right.lastServedOn.localeCompare(left.lastServedOn) ||
        left.mealName.localeCompare(right.mealName)
    );
}

function buildRecentMealPromptEntries(
  history: MealPromptHistoryEntry[],
  lastServedOn: string | null
) {
  const cutoff = addDateDays(lastServedOn, -30);

  if (!cutoff) {
    return [];
  }

  return history
    .filter((entry) => entry.servedOn >= cutoff)
    .sort(
      (left, right) =>
        right.servedOn.localeCompare(left.servedOn) ||
        left.weekday - right.weekday ||
        left.slotIndex - right.slotIndex
    )
    .map(toMealPromptHistoryPayloadEntry);
}

function buildRecentMealPromptWeeks(history: MealPromptHistoryEntry[], limit: number) {
  const weeks = new Map<string, MealPromptHistoryEntry[]>();

  for (const entry of history) {
    const current = weeks.get(entry.weekStartDate) ?? [];
    current.push(entry);
    weeks.set(entry.weekStartDate, current);
  }

  return [...weeks.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, limit)
    .map(([weekStartDate, entries]) => ({
      entries: entries
        .sort(
          (left, right) =>
            left.weekday - right.weekday || left.slotIndex - right.slotIndex
        )
        .map(toMealPromptHistoryPayloadEntry),
      weekStartDate
    }));
}

function toMealPromptHistoryPayloadEntry(entry: MealPromptHistoryEntry) {
  return {
    linkUrl: entry.linkUrl ?? '',
    mealName: entry.mealName,
    note: entry.note ?? '',
    servedOn: entry.servedOn,
    slotIndex: entry.slotIndex,
    sourceHint: entry.sourceHint ?? '',
    weekday: entry.weekday
  };
}

function detectSlotRole(
  count: number,
  breakfastLikeCount: number,
  mainMealLikeCount: number
): string {
  if (count === 0) {
    return 'brak danych';
  }

  if (breakfastLikeCount / count >= 0.55) {
    return 'prawdopodobnie sniadanie';
  }

  if (mainMealLikeCount / count >= 0.45) {
    return 'prawdopodobnie obiad lub danie glowne';
  }

  return 'mieszany slot - analizuj ostroznie';
}

function isBreakfastLike(mealName: string): boolean {
  return /(angielsk|burrat|crumble|dutch|gofr|jajeczn|jaglank|kanapk|kasza manna|nales|omlet|owsiank|pancake|parow|plack|smoothie|szakszuk|tortill|tost|twaroz|twaro|ryz z jabl)/.test(
    normalizeMealPromptText(mealName)
  );
}

function isMainMealLike(mealName: string): boolean {
  return /(bigos|carbonar|chinczyk|dorsz|fasolk|gnocci|gulasz|grill|klopsik|kurczak|leczo|makaron|paluszk|peczak|pierog|pizza|placki ziemniaczane|pomidorow|risotto|rosol|ryz|schab|schabow|spaghetti|tofu|zapiek|ziemniak|zupa)/.test(
    normalizeMealPromptText(mealName)
  );
}

function inferMealPromptSource(mealName: string, note: string | null): string | null {
  const normalizedMeal = normalizeMealPromptText(mealName);
  const normalizedNote = normalizeMealPromptText(note ?? '');
  const combined = `${normalizedNote} ${normalizedMeal}`;

  if (combined.includes('cookidoo') || /(^|[+\s])(c|cookidoo)(?=[+\s]|$)/.test(normalizedMeal)) {
    return 'Cookidoo';
  }

  if (
    combined.includes('kwestia smaku') ||
    /(^|[+\s])(ks|kwestia smaku)(?=[+\s]|$)/.test(normalizedMeal)
  ) {
    return 'Kwestia Smaku';
  }

  if (combined.includes('ania gotuje') || combined.includes('aniagotuje')) {
    return 'AniaGotuje';
  }

  if (combined.includes('instagram') || /(^|[+\s])(ig|insta)(?=[+\s]|$)/.test(normalizedMeal)) {
    return 'Instagram';
  }

  if (combined.includes('knorr')) {
    return 'Knorr';
  }

  if (combined.includes('moje wypieki')) {
    return 'Moje Wypieki';
  }

  if (combined.includes('rozkoszny')) {
    return 'Rozkoszny';
  }

  return null;
}

function normalizeMealPromptText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\u0142/g, 'l')
    .replace(/\u0141/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

function addDateDays(date: string | null, days: number): string | null {
  if (!date) {
    return null;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setUTCDate(parsed.getUTCDate() + days);

  return parsed.toISOString().slice(0, 10);
}

function getWeekdayName(weekday: number): string {
  return (
    [
      'poniedzialek',
      'wtorek',
      'sroda',
      'czwartek',
      'piatek',
      'sobota',
      'niedziela'
    ][weekday - 1] ?? `dzien ${weekday}`
  );
}

interface MealPromptHistoryRow {
  link_url: string | null;
  meal_name: string;
  note: string | null;
  served_on: Date | string;
  slot_index: number;
  weekday: number;
  week_start_date: Date | string;
}

interface MealPromptHistoryEntry {
  linkUrl: string | null;
  mealName: string;
  note: string | null;
  servedOn: string;
  slotIndex: number;
  sourceHint: string | null;
  weekday: number;
  weekStartDate: string;
}

interface MealPromptFrequency {
  count: number;
  lastServedOn: string;
  mealName: string;
  slotIndexes: number[];
  sourceHints: string[];
  weekdays: number[];
}

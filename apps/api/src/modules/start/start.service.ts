import { Injectable } from '@nestjs/common';
import { CalendarService } from '../calendar/calendar.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class StartService {
  constructor(
    private readonly database: DatabaseService,
    private readonly calendarService: CalendarService
  ) {}

  async getDashboard(householdId: string): Promise<StartDashboardRecord> {
    const [finance, upcomingEvents, mealPlan, todoPreview] = await Promise.all([
      this.getFinanceSummary(householdId),
      this.getUpcomingEvents(householdId),
      this.getCurrentMealPlan(householdId),
      this.getTodoPreview(householdId)
    ]);

    return {
      finance,
      mealPlan,
      todoPreview,
      upcomingEvents
    };
  }

  private async getFinanceSummary(householdId: string): Promise<StartFinanceSummary | null> {
    const monthResult = await this.database.query<BudgetMonthRow>(
      `
        select id, year, month
        from budget_months
        where household_id = $1
          and is_current = true
        limit 1
      `,
      [householdId]
    );
    const month = monthResult.rows[0];

    if (!month) {
      return null;
    }

    const summaryResult = await this.database.query<FinanceSummaryRow>(
      `
        select
          coalesce(sum(income_amount), 0)::numeric(12, 2) as income_amount,
          coalesce(sum(total_budget_amount), 0)::numeric(12, 2) as total_budget_amount,
          coalesce(sum(total_spent_amount), 0)::numeric(12, 2) as total_spent_amount,
          coalesce(sum(total_remaining_amount), 0)::numeric(12, 2) as total_remaining_amount
        from v_budget_person_summary
        where budget_month_id = $1
      `,
      [month.id]
    );
    const summary = summaryResult.rows[0];

    return {
      incomeAmount: summary?.income_amount ?? '0.00',
      month: {
        id: month.id,
        month: month.month,
        year: month.year
      },
      totalBudgetAmount: summary?.total_budget_amount ?? '0.00',
      totalRemainingAmount: summary?.total_remaining_amount ?? '0.00',
      totalSpentAmount: summary?.total_spent_amount ?? '0.00'
    };
  }

  private async getUpcomingEvents(householdId: string): Promise<StartCalendarEvent[]> {
    const events = await this.calendarService.listUpcoming(householdId, 5);

    return events.map((event) => ({
      eventDate: event.eventDate,
      eventTime: event.eventTime,
      id: event.id,
      ownerMemberId: event.ownerMemberId,
      scopeType: event.scopeType,
      title: event.title
    }));
  }

  private async getCurrentMealPlan(householdId: string): Promise<StartMealPlan | null> {
    const weekResult = await this.database.query<MealPlanWeekRow>(
      `
        select id, week_start_date
        from meal_plan_weeks
        where household_id = $1
          and week_start_date = (
            current_date - ((extract(isodow from current_date)::integer - 1) * interval '1 day')
          )::date
        limit 1
      `,
      [householdId]
    );
    const week = weekResult.rows[0];

    if (!week) {
      return null;
    }

    const entriesResult = await this.database.query<MealPlanEntryRow>(
      `
        select id, weekday, slot_index, meal_name
        from meal_plan_entries
        where meal_plan_week_id = $1
        order by weekday asc, slot_index asc
      `,
      [week.id]
    );

    return {
      entries: entriesResult.rows.map((row) => ({
        id: row.id,
        mealName: row.meal_name,
        slotIndex: row.slot_index,
        weekday: row.weekday
      })),
      id: week.id,
      weekStartDate: this.formatDateOnly(week.week_start_date)
    };
  }

  private async getTodoPreview(householdId: string): Promise<StartTodoItem[]> {
    const result = await this.database.query<TodoItemRow>(
      `
        select id, title, scope_type, owner_member_id, created_at
        from todo_items
        where household_id = $1
          and scope_type = 'household'
          and status = 'todo'
        order by created_at desc
        limit 5
      `,
      [householdId]
    );

    return result.rows.map((row) => ({
      createdAt: row.created_at,
      id: row.id,
      ownerMemberId: row.owner_member_id,
      scopeType: row.scope_type,
      title: row.title
    }));
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

interface BudgetMonthRow {
  id: string;
  month: number;
  year: number;
}

interface FinanceSummaryRow {
  income_amount: string;
  total_budget_amount: string;
  total_remaining_amount: string;
  total_spent_amount: string;
}

interface MealPlanWeekRow {
  id: string;
  week_start_date: Date | string;
}

interface MealPlanEntryRow {
  id: string;
  meal_name: string;
  slot_index: number;
  weekday: number;
}

interface TodoItemRow {
  created_at: string;
  id: string;
  owner_member_id: string | null;
  scope_type: 'household' | 'member';
  title: string;
}

export interface StartDashboardRecord {
  finance: StartFinanceSummary | null;
  mealPlan: StartMealPlan | null;
  todoPreview: StartTodoItem[];
  upcomingEvents: StartCalendarEvent[];
}

export interface StartFinanceSummary {
  incomeAmount: string;
  month: {
    id: string;
    month: number;
    year: number;
  };
  totalBudgetAmount: string;
  totalRemainingAmount: string;
  totalSpentAmount: string;
}

export interface StartCalendarEvent {
  eventDate: string;
  eventTime: string | null;
  id: string;
  ownerMemberId: string | null;
  scopeType: 'household' | 'member';
  title: string;
}

export interface StartMealPlan {
  entries: StartMealEntry[];
  id: string;
  weekStartDate: string;
}

export interface StartMealEntry {
  id: string;
  mealName: string;
  slotIndex: number;
  weekday: number;
}

export interface StartTodoItem {
  createdAt: string;
  id: string;
  ownerMemberId: string | null;
  scopeType: 'household' | 'member';
  title: string;
}

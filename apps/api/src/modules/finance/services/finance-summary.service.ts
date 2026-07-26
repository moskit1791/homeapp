import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BudgetMonthRecord } from './budget-months.service';

@Injectable()
export class FinanceSummaryService {
  constructor(private readonly database: DatabaseService) {}

  async getCurrentMonthDetail(householdId: string): Promise<BudgetMonthDetail> {
    const month = await this.findCurrentMonth(householdId);

    return this.getMonthDetail(householdId, month.id);
  }

  async getMonthDetail(householdId: string, budgetMonthId: string): Promise<BudgetMonthDetail> {
    const month = await this.findMonth(householdId, budgetMonthId);
    const [categoryRows, expenses, incomes, personSummary] = await Promise.all([
      this.listCategoryItemRows(householdId, budgetMonthId),
      this.listExpenses(householdId, budgetMonthId),
      this.listIncomes(householdId, budgetMonthId),
      this.getPersonSummary(householdId, budgetMonthId)
    ]);

    return {
      categories: this.groupCategories(categoryRows, expenses),
      incomes,
      month,
      personSummary,
      summary: this.buildSummary(personSummary)
    };
  }

  async getPersonSummary(
    householdId: string,
    budgetMonthId: string
  ): Promise<PersonSummaryRecord[]> {
    await this.findMonth(householdId, budgetMonthId);

    const result = await this.database.query<PersonSummaryRow>(
      `
        select
          v.budget_month_id,
          v.owner_member_id,
          u.display_name,
          u.email,
          v.income_amount,
          v.total_budget_amount,
          v.total_spent_amount,
          v.total_remaining_amount
        from v_budget_person_summary v
        join household_members hm on hm.id = v.owner_member_id
        join users u on u.id = hm.user_id
        where hm.household_id = $1
          and v.budget_month_id = $2
        order by
          case hm.role when 'owner' then 0 else 1 end,
          u.display_name asc
      `,
      [householdId, budgetMonthId]
    );

    return result.rows.map((row) => ({
      budgetMonthId: row.budget_month_id,
      displayName: row.display_name,
      email: row.email,
      incomeAmount: row.income_amount,
      ownerMemberId: row.owner_member_id,
      totalBudgetAmount: row.total_budget_amount,
      totalRemainingAmount: row.total_remaining_amount,
      totalSpentAmount: row.total_spent_amount
    }));
  }

  private async findCurrentMonth(householdId: string): Promise<BudgetMonthRecord> {
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

  private async findMonth(householdId: string, budgetMonthId: string): Promise<BudgetMonthRecord> {
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
      [householdId, budgetMonthId]
    );

    return this.mapMonthOrThrow(result.rows[0], 'Budget month not found');
  }

  private async listCategoryItemRows(
    householdId: string,
    budgetMonthId: string
  ): Promise<CategoryItemRow[]> {
    const result = await this.database.query<CategoryItemRow>(
      `
        select
          bc.id as category_id,
          bc.household_id,
          bc.name as category_name,
          bc.encrypted_payload as category_encrypted_payload,
          bc.encryption_version as category_encryption_version,
          coalesce(bmco.display_order, bc.display_order) as category_display_order,
          bc.copy_budget_to_next_month,
          bc.is_active as category_is_active,
          bi.id as budget_item_id,
          bi.budget_month_id,
          bi.owner_member_id,
          owner_user.display_name as owner_display_name,
          owner_user.email as owner_email,
          bi.name as budget_item_name,
          bi.budget_amount,
          bi.encrypted_payload as budget_item_encrypted_payload,
          bi.encryption_version as budget_item_encryption_version,
          bit.spent_amount,
          bit.remaining_amount,
          bi.display_order as budget_item_display_order,
          bi.created_at as budget_item_created_at,
          bi.updated_at as budget_item_updated_at
        from budget_categories bc
        left join budget_month_category_orders bmco
          on bmco.category_id = bc.id
          and bmco.budget_month_id = $2
        left join budget_items bi
          on bi.category_id = bc.id
          and bi.budget_month_id = $2
          and bi.is_deleted = false
        left join v_budget_item_totals bit on bit.budget_item_id = bi.id
        left join household_members owner_member on owner_member.id = bi.owner_member_id
        left join users owner_user on owner_user.id = owner_member.user_id
        where bc.household_id = $1
          and (bc.is_active = true or bi.id is not null)
        order by
          coalesce(bmco.display_order, bc.display_order) asc,
          bc.name asc,
          bi.display_order asc nulls last,
          bi.created_at asc nulls last
      `,
      [householdId, budgetMonthId]
    );

    return result.rows;
  }

  private async listIncomes(
    householdId: string,
    budgetMonthId: string
  ): Promise<IncomeSummaryRecord[]> {
    const result = await this.database.query<IncomeSummaryRow>(
      `
        select
          hm.id as owner_member_id,
          u.display_name,
          u.email,
          coalesce(mi.amount, 0)::numeric(12, 2) as amount
          ,mi.encrypted_payload
          ,mi.encryption_version
        from household_members hm
        join users u on u.id = hm.user_id
        left join monthly_incomes mi
          on mi.owner_member_id = hm.id
          and mi.budget_month_id = $2
        where hm.household_id = $1
          and hm.is_active = true
        order by
          case hm.role when 'owner' then 0 else 1 end,
          u.display_name asc
      `,
      [householdId, budgetMonthId]
    );

    return result.rows.map((row) => ({
      amount: row.amount,
      displayName: row.display_name,
      email: row.email,
      encryptedPayload: row.encrypted_payload,
      encryptionVersion: row.encryption_version,
      ownerMemberId: row.owner_member_id
    }));
  }

  private async listExpenses(
    householdId: string,
    budgetMonthId: string
  ): Promise<ExpenseSummaryRecord[]> {
    const result = await this.database.query<ExpenseSummaryRow>(
      `
        select
          e.id,
          e.budget_item_id,
          e.amount,
          e.name,
          e.source,
          e.source_external_id,
          e.occurred_at,
          e.original_amount,
          e.original_currency,
          e.encrypted_payload,
          e.encryption_version,
          e.created_at,
          e.updated_at
        from expenses e
        join budget_items bi on bi.id = e.budget_item_id
        join budget_months bm on bm.id = bi.budget_month_id
        where bm.household_id = $1
          and bm.id = $2
          and bi.is_deleted = false
        order by e.created_at desc, e.id desc
      `,
      [householdId, budgetMonthId]
    );

    return result.rows.map((row) => ({
      amount: row.amount,
      budgetItemId: row.budget_item_id,
      createdAt: row.created_at,
      encryptedPayload: row.encrypted_payload,
      encryptionVersion: row.encryption_version,
      id: row.id,
      name: row.name,
      occurredAt: row.occurred_at,
      originalAmount: row.original_amount,
      originalCurrency: row.original_currency,
      source: row.source ?? 'manual',
      sourceExternalId: row.source_external_id,
      updatedAt: row.updated_at
    }));
  }

  private groupCategories(
    rows: CategoryItemRow[],
    expenses: ExpenseSummaryRecord[]
  ): CategoryWithItemsRecord[] {
    const categories = new Map<string, CategoryWithItemsRecord>();
    const expensesByItemId = new Map<string, ExpenseSummaryRecord[]>();

    for (const expense of expenses) {
      const bucket = expensesByItemId.get(expense.budgetItemId) ?? [];

      bucket.push(expense);
      expensesByItemId.set(expense.budgetItemId, bucket);
    }

    for (const row of rows) {
      let category = categories.get(row.category_id);

      if (!category) {
        category = {
          copyBudgetToNextMonth: row.copy_budget_to_next_month,
          displayOrder: row.category_display_order,
          encryptedPayload: row.category_encrypted_payload,
          encryptionVersion: row.category_encryption_version,
          householdId: row.household_id,
          id: row.category_id,
          isActive: row.category_is_active,
          items: [],
          name: row.category_name
        };
        categories.set(row.category_id, category);
      }

      if (row.budget_item_id) {
        category.items.push({
          budgetAmount: row.budget_amount,
          budgetMonthId: this.required(row.budget_month_id, 'budget month id'),
          categoryId: row.category_id,
          createdAt: this.required(row.budget_item_created_at, 'budget item created at'),
          displayOrder: this.required(row.budget_item_display_order, 'budget item display order'),
          encryptedPayload: row.budget_item_encrypted_payload,
          encryptionVersion: row.budget_item_encryption_version,
          expenses: expensesByItemId.get(row.budget_item_id) ?? [],
          id: row.budget_item_id,
          name: this.required(row.budget_item_name, 'budget item name'),
          owner: {
            displayName: this.required(row.owner_display_name, 'owner display name'),
            email: this.required(row.owner_email, 'owner email'),
            memberId: this.required(row.owner_member_id, 'owner member id')
          },
          remainingAmount: row.remaining_amount,
          spentAmount: this.required(row.spent_amount, 'spent amount'),
          updatedAt: this.required(row.budget_item_updated_at, 'budget item updated at')
        });
      }
    }

    return [...categories.values()];
  }

  private buildSummary(personSummary: PersonSummaryRecord[]): FinanceTotalSummary {
    return personSummary.reduce<FinanceTotalSummary>(
      (summary, person) => ({
        incomeAmount: this.addMoney(summary.incomeAmount, person.incomeAmount),
        totalBudgetAmount: this.addMoney(summary.totalBudgetAmount, person.totalBudgetAmount),
        totalRemainingAmount: this.addMoney(
          summary.totalRemainingAmount,
          person.totalRemainingAmount
        ),
        totalSpentAmount: this.addMoney(summary.totalSpentAmount, person.totalSpentAmount)
      }),
      {
        incomeAmount: '0.00',
        totalBudgetAmount: '0.00',
        totalRemainingAmount: '0.00',
        totalSpentAmount: '0.00'
      }
    );
  }

  private addMoney(left: string, right: string): string {
    return (Number(left) + Number(right)).toFixed(2);
  }

  private required<T>(value: T | null, label: string): T {
    if (value === null) {
      throw new Error(`Expected ${label}`);
    }

    return value;
  }

  private mapMonthOrThrow(row: BudgetMonthRow | undefined, message: string): BudgetMonthRecord {
    if (!row) {
      throw new NotFoundException(message);
    }

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

interface CategoryItemRow {
  budget_amount: string | null;
  budget_item_created_at: string | null;
  budget_item_display_order: number | null;
  budget_item_encrypted_payload: string | null;
  budget_item_encryption_version: number | null;
  budget_item_id: string | null;
  budget_item_name: string | null;
  budget_item_updated_at: string | null;
  budget_month_id: string | null;
  category_display_order: number;
  category_encrypted_payload: string | null;
  category_encryption_version: number | null;
  category_id: string;
  category_is_active: boolean;
  category_name: string;
  copy_budget_to_next_month: boolean;
  household_id: string;
  owner_display_name: string | null;
  owner_email: string | null;
  owner_member_id: string | null;
  remaining_amount: string | null;
  spent_amount: string | null;
}

interface ExpenseSummaryRow {
  amount: string;
  budget_item_id: string;
  created_at: string;
  encrypted_payload: string | null;
  encryption_version: number | null;
  id: string;
  name: string | null;
  occurred_at: string | null;
  original_amount: string | null;
  original_currency: string | null;
  source: 'manual' | 'bank_notification' | null;
  source_external_id: string | null;
  updated_at: string;
}

interface IncomeSummaryRow {
  amount: string;
  display_name: string;
  email: string;
  encrypted_payload: string | null;
  encryption_version: number | null;
  owner_member_id: string;
}

interface PersonSummaryRow {
  budget_month_id: string;
  display_name: string;
  email: string;
  income_amount: string;
  owner_member_id: string;
  total_budget_amount: string;
  total_remaining_amount: string;
  total_spent_amount: string;
}

export interface BudgetMonthDetail {
  categories: CategoryWithItemsRecord[];
  incomes: IncomeSummaryRecord[];
  month: BudgetMonthRecord;
  personSummary: PersonSummaryRecord[];
  summary: FinanceTotalSummary;
}

export interface CategoryWithItemsRecord {
  copyBudgetToNextMonth: boolean;
  displayOrder: number;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  householdId: string;
  id: string;
  isActive: boolean;
  items: BudgetItemSummaryRecord[];
  name: string;
}

export interface BudgetItemSummaryRecord {
  budgetAmount: string | null;
  budgetMonthId: string;
  categoryId: string;
  createdAt: string;
  displayOrder: number;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  expenses: ExpenseSummaryRecord[];
  id: string;
  name: string;
  owner: { displayName: string; email: string; memberId: string };
  remainingAmount: string | null;
  spentAmount: string;
  updatedAt: string;
}

export interface ExpenseSummaryRecord {
  amount: string;
  budgetItemId: string;
  createdAt: string;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  id: string;
  name: string | null;
  occurredAt: string | null;
  originalAmount: string | null;
  originalCurrency: string | null;
  source: 'manual' | 'bank_notification';
  sourceExternalId: string | null;
  updatedAt: string;
}

export interface IncomeSummaryRecord {
  amount: string;
  displayName: string;
  email: string;
  encryptedPayload: string | null;
  encryptionVersion: number | null;
  ownerMemberId: string;
}

export interface PersonSummaryRecord {
  budgetMonthId: string;
  displayName: string;
  email: string;
  incomeAmount: string;
  ownerMemberId: string;
  totalBudgetAmount: string;
  totalRemainingAmount: string;
  totalSpentAmount: string;
}

export interface FinanceTotalSummary {
  incomeAmount: string;
  totalBudgetAmount: string;
  totalRemainingAmount: string;
  totalSpentAmount: string;
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { CreateBudgetCategoryDto, UpdateBudgetCategoryDto } from '../dto/finance.dto';

@Injectable()
export class BudgetCategoriesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async listCategories(householdId: string): Promise<BudgetCategoryRecord[]> {
    const result = await this.database.query<BudgetCategoryRow>(
      `
        select
          id,
          household_id,
          name,
          display_order,
          copy_budget_to_next_month,
          is_active,
          created_at,
          updated_at
        from budget_categories
        where household_id = $1
          and is_active = true
        order by display_order asc, name asc
      `,
      [householdId]
    );

    return result.rows.map((row) => this.mapCategory(row));
  }

  async createCategory(householdId: string, dto: CreateBudgetCategoryDto): Promise<BudgetCategoryRecord> {
    const result = await this.database.query<BudgetCategoryRow>(
      `
        insert into budget_categories (
          household_id,
          name,
          display_order,
          copy_budget_to_next_month
        )
        values (
          $1,
          $2,
          coalesce(
            $3,
            (
              select coalesce(max(display_order), -1) + 1
              from budget_categories
              where household_id = $1
            )
          ),
          $4
        )
        returning
          id,
          household_id,
          name,
          display_order,
          copy_budget_to_next_month,
          is_active,
          created_at,
          updated_at
      `,
      [householdId, this.normalizeName(dto.name), dto.displayOrder ?? null, dto.copyBudgetToNextMonth ?? false]
    );

    const category = this.mapCategoryOrThrow(result.rows[0]);
    this.realtime.publish(householdId, 'finance.changed', category.id);

    return category;
  }

  async updateCategory(
    householdId: string,
    categoryId: string,
    dto: UpdateBudgetCategoryDto
  ): Promise<BudgetCategoryRecord | null> {
    if (
      dto.name === undefined &&
      dto.displayOrder === undefined &&
      dto.copyBudgetToNextMonth === undefined &&
      dto.isActive === undefined
    ) {
      throw new BadRequestException('No budget category fields to update');
    }

    const result = await this.database.query<BudgetCategoryRow>(
      `
        update budget_categories
        set
          name = coalesce($3, name),
          display_order = coalesce($4, display_order),
          copy_budget_to_next_month = coalesce($5, copy_budget_to_next_month),
          is_active = coalesce($6, is_active)
        where household_id = $1
          and id = $2
        returning
          id,
          household_id,
          name,
          display_order,
          copy_budget_to_next_month,
          is_active,
          created_at,
          updated_at
      `,
      [
        householdId,
        categoryId,
        dto.name === undefined ? null : this.normalizeName(dto.name),
        dto.displayOrder ?? null,
        dto.copyBudgetToNextMonth ?? null,
        dto.isActive ?? null
      ]
    );

    const category = result.rows[0] ? this.mapCategory(result.rows[0]) : null;

    if (category) {
      this.realtime.publish(householdId, 'finance.changed', category.id);
    }

    return category;
  }

  private normalizeName(name: string): string {
    const normalized = name.trim();

    if (!normalized) {
      throw new BadRequestException('Budget category name is required');
    }

    return normalized;
  }

  private mapCategoryOrThrow(row: BudgetCategoryRow | undefined): BudgetCategoryRecord {
    if (!row) {
      throw new Error('Expected budget category record');
    }

    return this.mapCategory(row);
  }

  private mapCategory(row: BudgetCategoryRow): BudgetCategoryRecord {
    return {
      copyBudgetToNextMonth: row.copy_budget_to_next_month,
      createdAt: row.created_at,
      displayOrder: row.display_order,
      householdId: row.household_id,
      id: row.id,
      isActive: row.is_active,
      name: row.name,
      updatedAt: row.updated_at
    };
  }
}

interface BudgetCategoryRow {
  copy_budget_to_next_month: boolean;
  created_at: string;
  display_order: number;
  household_id: string;
  id: string;
  is_active: boolean;
  name: string;
  updated_at: string;
}

export interface BudgetCategoryRecord {
  copyBudgetToNextMonth: boolean;
  createdAt: string;
  displayOrder: number;
  householdId: string;
  id: string;
  isActive: boolean;
  name: string;
  updatedAt: string;
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { CreateBudgetItemDto, UpdateBudgetItemDto } from '../dto/finance.dto';

@Injectable()
export class BudgetItemsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async createBudgetItem(
    householdId: string,
    dto: CreateBudgetItemDto
  ): Promise<BudgetItemRecord> {
    await this.ensureCurrentBudgetMonth(householdId, dto.budgetMonthId);
    await this.ensureActiveMember(householdId, dto.ownerMemberId);
    await this.ensureActiveCategory(householdId, dto.categoryId);

    const displayOrder =
      dto.displayOrder ??
      (await this.nextDisplayOrder(dto.budgetMonthId, dto.ownerMemberId, dto.categoryId));
    const result = await this.database.query<BudgetItemRow>(
      `
        insert into budget_items (
          budget_month_id,
          owner_member_id,
          category_id,
          name,
          budget_amount,
          display_order
        )
        values ($1, $2, $3, $4, $5, $6)
        returning
          id,
          budget_month_id,
          owner_member_id,
          category_id,
          name,
          budget_amount,
          display_order,
          is_deleted,
          created_at,
          updated_at
      `,
      [
        dto.budgetMonthId,
        dto.ownerMemberId,
        dto.categoryId,
        this.normalizeName(dto.name),
        dto.budgetAmount ?? null,
        displayOrder
      ]
    );

    const item = this.mapItemOrThrow(result.rows[0], 'Expected budget item record');
    this.realtime.publish(householdId, 'finance.changed', item.id);

    return item;
  }

  async updateBudgetItem(
    householdId: string,
    budgetItemId: string,
    dto: UpdateBudgetItemDto
  ): Promise<BudgetItemRecord | null> {
    if (
      dto.ownerMemberId === undefined &&
      dto.categoryId === undefined &&
      dto.name === undefined &&
      dto.budgetAmount === undefined &&
      dto.displayOrder === undefined
    ) {
      throw new BadRequestException('No budget item fields to update');
    }

    const current = await this.findMutableItem(householdId, budgetItemId);

    if (!current) {
      return null;
    }

    if (dto.ownerMemberId !== undefined) {
      await this.ensureActiveMember(householdId, dto.ownerMemberId);
    }

    if (dto.categoryId !== undefined) {
      await this.ensureActiveCategory(householdId, dto.categoryId);
    }

    const result = await this.database.query<BudgetItemRow>(
      `
        update budget_items
        set
          owner_member_id = coalesce($3, owner_member_id),
          category_id = coalesce($4, category_id),
          name = coalesce($5, name),
          budget_amount = $6,
          display_order = coalesce($7, display_order)
        where id = $2
          and exists (
            select 1
            from budget_months bm
            where bm.id = budget_items.budget_month_id
              and bm.household_id = $1
              and bm.is_current = true
          )
        returning
          id,
          budget_month_id,
          owner_member_id,
          category_id,
          name,
          budget_amount,
          display_order,
          is_deleted,
          created_at,
          updated_at
      `,
      [
        householdId,
        budgetItemId,
        dto.ownerMemberId ?? null,
        dto.categoryId ?? null,
        dto.name === undefined ? null : this.normalizeName(dto.name),
        dto.budgetAmount === undefined ? current.budgetAmount : dto.budgetAmount,
        dto.displayOrder ?? null
      ]
    );

    const item = result.rows[0] ? this.mapItem(result.rows[0]) : null;

    if (item) {
      this.realtime.publish(householdId, 'finance.changed', item.id);
    }

    return item;
  }

  async deleteBudgetItem(householdId: string, budgetItemId: string): Promise<boolean> {
    const current = await this.findMutableItem(householdId, budgetItemId);

    if (!current) {
      return false;
    }

    const result = await this.database.query(
      `
        update budget_items
        set is_deleted = true
        where id = $2
          and is_deleted = false
          and exists (
            select 1
            from budget_months bm
            where bm.id = budget_items.budget_month_id
              and bm.household_id = $1
              and bm.is_current = true
          )
      `,
      [householdId, budgetItemId]
    );

    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, 'finance.changed', budgetItemId);
    }

    return deleted;
  }

  private async findMutableItem(
    householdId: string,
    budgetItemId: string
  ): Promise<BudgetItemRecord | null> {
    const result = await this.database.query<BudgetItemRow>(
      `
        select
          bi.id,
          bi.budget_month_id,
          bi.owner_member_id,
          bi.category_id,
          bi.name,
          bi.budget_amount,
          bi.display_order,
          bi.is_deleted,
          bi.created_at,
          bi.updated_at
        from budget_items bi
        join budget_months bm on bm.id = bi.budget_month_id
        where bm.household_id = $1
          and bm.is_current = true
          and bi.id = $2
          and bi.is_deleted = false
        limit 1
      `,
      [householdId, budgetItemId]
    );

    return result.rows[0] ? this.mapItem(result.rows[0]) : null;
  }

  private async ensureCurrentBudgetMonth(
    householdId: string,
    budgetMonthId: string
  ): Promise<void> {
    const result = await this.database.query<{ id: string }>(
      `
        select id
        from budget_months
        where household_id = $1
          and id = $2
          and is_current = true
        limit 1
      `,
      [householdId, budgetMonthId]
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Budget month is not current');
    }
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
      throw new BadRequestException('Budget owner member is not active in household');
    }
  }

  private async ensureActiveCategory(householdId: string, categoryId: string): Promise<void> {
    const result = await this.database.query<{ id: string }>(
      `
        select id
        from budget_categories
        where household_id = $1
          and id = $2
          and is_active = true
        limit 1
      `,
      [householdId, categoryId]
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Budget category is not active in household');
    }
  }

  private async nextDisplayOrder(
    budgetMonthId: string,
    ownerMemberId: string,
    categoryId: string
  ): Promise<number> {
    const result = await this.database.query<{ next_display_order: number }>(
      `
        select coalesce(max(display_order), -1) + 1 as next_display_order
        from budget_items
        where budget_month_id = $1
          and owner_member_id = $2
          and category_id = $3
          and is_deleted = false
      `,
      [budgetMonthId, ownerMemberId, categoryId]
    );

    return result.rows[0]?.next_display_order ?? 0;
  }

  private normalizeName(name: string): string {
    const normalized = name.trim();

    if (!normalized) {
      throw new BadRequestException('Budget item name is required');
    }

    return normalized;
  }

  private mapItemOrThrow(row: BudgetItemRow | undefined, message: string): BudgetItemRecord {
    if (!row) {
      throw new Error(message);
    }

    return this.mapItem(row);
  }

  private mapItem(row: BudgetItemRow): BudgetItemRecord {
    return {
      budgetAmount: row.budget_amount,
      budgetMonthId: row.budget_month_id,
      categoryId: row.category_id,
      createdAt: row.created_at,
      displayOrder: row.display_order,
      id: row.id,
      isDeleted: row.is_deleted,
      name: row.name,
      ownerMemberId: row.owner_member_id,
      updatedAt: row.updated_at
    };
  }
}

interface BudgetItemRow {
  budget_amount: string | null;
  budget_month_id: string;
  category_id: string;
  created_at: string;
  display_order: number;
  id: string;
  is_deleted: boolean;
  name: string;
  owner_member_id: string;
  updated_at: string;
}

export interface BudgetItemRecord {
  budgetAmount: string | null;
  budgetMonthId: string;
  categoryId: string;
  createdAt: string;
  displayOrder: number;
  id: string;
  isDeleted: boolean;
  name: string;
  ownerMemberId: string;
  updatedAt: string;
}

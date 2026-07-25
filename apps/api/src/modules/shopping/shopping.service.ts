import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  SHOPPING_AI_CATEGORIES,
  ShoppingAiService,
  type ShoppingAiCategory,
  type ShoppingAiSourceFragment
} from './shopping-ai.service';
import {
  CreateShoppingItemDto,
  ImportShoppingItemsWithAiDto,
  MoveShoppingItemDto,
  ShoppingListType,
  UpdateShoppingItemDto
} from './dto/shopping.dto';

@Injectable()
export class ShoppingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService,
    private readonly shoppingAi: ShoppingAiService
  ) {}

  async listShoppingLists(householdId: string): Promise<ShoppingListRecord[]> {
    await this.ensureShoppingState(householdId);

    const result = await this.database.query<ShoppingListRow>(
      `
        select id, household_id, type, name, created_at, updated_at
        from shopping_lists
        where household_id = $1
        order by
          case type
            when 'daily' then 0
            when 'tomorrow' then 1
            when 'long_term' then 2
            else 3
          end,
          name asc
      `,
      [householdId]
    );

    return result.rows.map((row) => this.mapList(row));
  }

  async listItems(
    householdId: string,
    type: ShoppingListType
  ): Promise<ShoppingItemRecord[]> {
    await this.ensureShoppingState(householdId);

    const result = await this.database.query<ShoppingItemRow>(
      `
        select
          sli.id,
          sli.shopping_list_id,
          sl.household_id,
          sl.type,
          sli.name,
          sli.quantity,
          sli.category,
          sli.expiration_date,
          sli.encrypted_payload,
          sli.encryption_version,
          sli.is_checked,
          sli.checked_at,
          sli.display_order,
          sli.created_at,
          sli.updated_at
        from shopping_list_items sli
        join shopping_lists sl on sl.id = sli.shopping_list_id
        where sl.household_id = $1
          and sl.type = $2
        order by
          sli.is_checked asc,
          sli.display_order asc,
          sli.created_at asc
      `,
      [householdId, type]
    );

    return result.rows.map((row) => this.mapItem(row));
  }

  async getPantryDashboard(householdId: string): Promise<PantryDashboardRecord> {
    await this.ensureShoppingState(householdId);

    const [items, shoppingCountResult] = await Promise.all([
      this.listItems(householdId, 'pantry'),
      this.database.query<{ count: string }>(
        `
          select count(*)::text as count
          from shopping_list_items sli
          join shopping_lists sl on sl.id = sli.shopping_list_id
          where sl.household_id = $1
            and sl.type <> 'pantry'
            and sli.is_checked = false
        `,
        [householdId]
      )
    ]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const warningDate = new Date(today);
    warningDate.setDate(warningDate.getDate() + 7);
    const datedItems = items.filter((item) => item.expirationDate);

    return {
      items,
      stats: {
        expiringSoon: datedItems.filter((item) => {
          const expiration = new Date(`${item.expirationDate}T12:00:00`);
          return expiration >= today && expiration <= warningDate;
        }).length,
        expired: datedItems.filter(
          (item) => new Date(`${item.expirationDate}T12:00:00`) < today
        ).length,
        shoppingList: Number(shoppingCountResult.rows[0]?.count ?? 0),
        total: items.length
      }
    };
  }

  async createItem(
    householdId: string,
    type: ShoppingListType,
    dto: CreateShoppingItemDto
  ): Promise<ShoppingItemRecord> {
    await this.ensureShoppingState(householdId);

    const item = await this.database.transaction(async (client) => {
      const listId = await this.getListId(client, householdId, type);

      return this.upsertItemInList(client, householdId, type, listId, dto);
    });
    this.realtime.publish(householdId, 'shopping.changed', item.id);

    return item;
  }

  async importItemsWithAi(
    householdId: string,
    type: ShoppingListType,
    dto: ImportShoppingItemsWithAiDto
  ): Promise<ShoppingAiImportResult> {
    const plan = await this.shoppingAi.planImport(dto.message);

    if (dto.planOnly) {
      return {
        ignoredSourceFragments: plan.ignoredSourceFragments,
        importedCount: 0,
        items: [],
        plannedItems: plan.items.map(({ category, name, quantity }) => ({
          category,
          name,
          quantity
        })),
        sourceFragments: plan.sourceFragments
      };
    }

    await this.ensureShoppingState(householdId);

    const items = await this.database.transaction(async (client) => {
      const listId = await this.getListId(client, householdId, type);
      let displayOrder = await this.nextDisplayOrder(client, listId);
      const importedItems: ShoppingItemRecord[] = [];

      for (const item of plan.items) {
        importedItems.push(
          await this.upsertItemInList(client, householdId, type, listId, {
            displayOrder,
            name: item.name,
            category: item.category,
            quantity: item.quantity
          })
        );
        displayOrder += 1;
      }

      return importedItems;
    });

    if (items.length > 0) {
      this.realtime.publish(householdId, 'shopping.changed', 'ai-import');
    }

    return {
      ignoredSourceFragments: plan.ignoredSourceFragments,
      importedCount: items.length,
      items,
      plannedItems: [],
      sourceFragments: plan.sourceFragments
    };
  }

  async updateItem(
    householdId: string,
    id: string,
    dto: UpdateShoppingItemDto
  ): Promise<ShoppingItemRecord | null> {
    const current = await this.findItem(householdId, id);

    if (!current) {
      return null;
    }

    const result = await this.database.query<ShoppingItemRow>(
      `
        update shopping_list_items sli
        set
          name = $3,
          quantity = $4,
          display_order = $5,
          category = $6,
          expiration_date = $7,
          encrypted_payload = $8,
          encryption_version = $9
        from shopping_lists sl
        where sl.id = sli.shopping_list_id
          and sl.household_id = $1
          and sli.id = $2
        returning
          sli.id,
          sli.shopping_list_id,
          sl.household_id,
          sl.type,
          sli.name,
          sli.quantity,
          sli.category,
          sli.expiration_date,
          sli.encrypted_payload,
          sli.encryption_version,
          sli.is_checked,
          sli.checked_at,
          sli.display_order,
          sli.created_at,
          sli.updated_at
      `,
      [
        householdId,
        id,
        dto.name?.trim() ?? current.name,
        dto.quantity?.trim() ?? current.quantity,
        dto.displayOrder ?? current.displayOrder,
        normalizeShoppingCategory(dto.category) ?? current.category,
        dto.expirationDate === undefined ? current.expirationDate : dto.expirationDate,
        dto.encryptedPayload ?? current.encryptedPayload,
        dto.encryptionVersion ?? current.encryptionVersion
      ]
    );

    const item = result.rows[0] ? this.mapItem(result.rows[0]) : null;

    if (item) {
      this.realtime.publish(householdId, 'shopping.changed', item.id);
    }

    return item;
  }

  async deleteItem(householdId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      `
        delete from shopping_list_items sli
        using shopping_lists sl
        where sl.id = sli.shopping_list_id
          and sl.household_id = $1
          and sli.id = $2
      `,
      [householdId, id]
    );
    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, 'shopping.changed', id);
    }

    return deleted;
  }

  async checkItem(householdId: string, id: string): Promise<ShoppingItemRecord | null> {
    const result = await this.database.query<ShoppingItemRow>(
      `
        update shopping_list_items sli
        set
          is_checked = true,
          checked_at = coalesce(sli.checked_at, now())
        from shopping_lists sl
        where sl.id = sli.shopping_list_id
          and sl.household_id = $1
          and sli.id = $2
        returning
          sli.id,
          sli.shopping_list_id,
          sl.household_id,
          sl.type,
          sli.name,
          sli.quantity,
          sli.category,
          sli.expiration_date,
          sli.encrypted_payload,
          sli.encryption_version,
          sli.is_checked,
          sli.checked_at,
          sli.display_order,
          sli.created_at,
          sli.updated_at
      `,
      [householdId, id]
    );
    const item = result.rows[0] ? this.mapItem(result.rows[0]) : null;

    if (item) {
      this.realtime.publish(householdId, 'shopping.changed', item.id);
    }

    return item;
  }

  async toggleItem(householdId: string, id: string): Promise<ShoppingItemRecord | null> {
    const result = await this.database.query<ShoppingItemRow>(
      `
        update shopping_list_items sli
        set
          is_checked = not sli.is_checked,
          checked_at = case when sli.is_checked then null else now() end
        from shopping_lists sl
        where sl.id = sli.shopping_list_id
          and sl.household_id = $1
          and sli.id = $2
        returning
          sli.id,
          sli.shopping_list_id,
          sl.household_id,
          sl.type,
          sli.name,
          sli.quantity,
          sli.category,
          sli.expiration_date,
          sli.encrypted_payload,
          sli.encryption_version,
          sli.is_checked,
          sli.checked_at,
          sli.display_order,
          sli.created_at,
          sli.updated_at
      `,
      [householdId, id]
    );
    const item = result.rows[0] ? this.mapItem(result.rows[0]) : null;

    if (item) {
      this.realtime.publish(householdId, 'shopping.changed', item.id);
    }

    return item;
  }

  async clearList(householdId: string, type: ShoppingListType): Promise<{ deleted: number }> {
    await this.ensureShoppingState(householdId);

    const result = await this.database.query(
      `
        delete from shopping_list_items sli
        using shopping_lists sl
        where sl.id = sli.shopping_list_id
          and sl.household_id = $1
          and sl.type = $2
      `,
      [householdId, type]
    );
    const deleted = result.rowCount ?? 0;

    if (deleted > 0) {
      this.realtime.publish(householdId, 'shopping.changed', type);
    }

    return { deleted };
  }

  async moveItem(
    householdId: string,
    id: string,
    dto: MoveShoppingItemDto
  ): Promise<ShoppingItemRecord | null> {
    await this.ensureShoppingState(householdId);

    const item = await this.database.transaction(async (client) => {
      const targetListId = await this.getListId(client, householdId, dto.targetType);
      const displayOrder = await this.nextDisplayOrder(client, targetListId);
      const result = await client.query<ShoppingItemRow>(
        `
          update shopping_list_items sli
          set
            shopping_list_id = $3,
            is_checked = false,
            checked_at = null,
            display_order = $4
          from shopping_lists current_list
          where current_list.id = sli.shopping_list_id
            and current_list.household_id = $1
            and sli.id = $2
          returning
            sli.id,
            sli.shopping_list_id,
            current_list.household_id,
            $5::shopping_list_type as type,
            sli.name,
            sli.quantity,
            sli.category,
            sli.expiration_date,
            sli.encrypted_payload,
            sli.encryption_version,
            sli.is_checked,
            sli.checked_at,
            sli.display_order,
            sli.created_at,
            sli.updated_at
        `,
        [householdId, id, targetListId, displayOrder, dto.targetType]
      );

      return result.rows[0] ? this.mapItem(result.rows[0]) : null;
    });

    if (item) {
      this.realtime.publish(householdId, 'shopping.changed', item.id);
    }

    return item;
  }

  async moveUncheckedToTomorrow(householdId: string): Promise<{ moved: number }> {
    await this.ensureShoppingState(householdId);

    const moved = await this.database.transaction(async (client) => {
      const dailyListId = await this.getListId(client, householdId, 'daily');
      const tomorrowListId = await this.getListId(client, householdId, 'tomorrow');
      const baseOrder = await this.nextDisplayOrder(client, tomorrowListId);
      const result = await client.query(
        `
          with moved as (
            select
              id,
              row_number() over (order by display_order asc, created_at asc) - 1 as offset_order
            from shopping_list_items
            where shopping_list_id = $1
              and is_checked = false
          )
          update shopping_list_items item
          set
            shopping_list_id = $2,
            display_order = $3 + moved.offset_order,
            is_checked = false,
            checked_at = null
          from moved
          where item.id = moved.id
        `,
        [dailyListId, tomorrowListId, baseOrder]
      );

      return result.rowCount ?? 0;
    });

    if (moved > 0) {
      this.realtime.publish(householdId, 'shopping.changed', 'move-unchecked');
    }

    return { moved };
  }

  private async upsertItemInList(
    client: PoolClient,
    householdId: string,
    type: ShoppingListType,
    listId: string,
    dto: CreateShoppingItemDto
  ): Promise<ShoppingItemRecord> {
    const existing = dto.encryptedPayload
      ? null
      : await this.findDuplicateUncheckedItem(
          client,
          listId,
          normalizeProductName(dto.name)
        );

    if (existing) {
      const result = await client.query<ShoppingItemRow>(
        `
          update shopping_list_items
          set
            quantity = $2,
            category = coalesce($5, category),
            expiration_date = coalesce($7::date, expiration_date)
          where id = $1
            and shopping_list_id = $6
          returning
            id,
            shopping_list_id,
            $3::uuid as household_id,
            $4::shopping_list_type as type,
            name,
            quantity,
            category,
            expiration_date,
            encrypted_payload,
            encryption_version,
            is_checked,
            checked_at,
            display_order,
            created_at,
            updated_at
        `,
        [
          existing.id,
          mergeQuantity(existing.quantity, dto.quantity),
          householdId,
          type,
          normalizeShoppingCategory(dto.category),
          listId,
          dto.expirationDate ?? null
        ]
      );

      return this.mapItemOrThrow(result.rows[0]);
    }

    const displayOrder = dto.displayOrder ?? (await this.nextDisplayOrder(client, listId));
    const result = await client.query<ShoppingItemRow>(
      `
        insert into shopping_list_items (
          shopping_list_id,
          name,
          quantity,
          category,
          expiration_date,
          encrypted_payload,
          encryption_version,
          display_order
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning
          id,
          shopping_list_id,
          $9::uuid as household_id,
          $10::shopping_list_type as type,
          name,
          quantity,
          category,
          expiration_date,
          encrypted_payload,
          encryption_version,
          is_checked,
          checked_at,
          display_order,
          created_at,
          updated_at
      `,
      [
        listId,
        dto.name.trim(),
        dto.quantity?.trim() ?? '',
        normalizeShoppingCategory(dto.category),
        dto.expirationDate ?? null,
        dto.encryptedPayload ?? null,
        dto.encryptionVersion ?? null,
        displayOrder,
        householdId,
        type
      ]
    );

    return this.mapItemOrThrow(result.rows[0]);
  }

  private async findItem(householdId: string, id: string): Promise<ShoppingItemRecord | null> {
    const result = await this.database.query<ShoppingItemRow>(
      `
        select
          sli.id,
          sli.shopping_list_id,
          sl.household_id,
          sl.type,
          sli.name,
          sli.quantity,
          sli.category,
          sli.expiration_date,
          sli.encrypted_payload,
          sli.encryption_version,
          sli.is_checked,
          sli.checked_at,
          sli.display_order,
          sli.created_at,
          sli.updated_at
        from shopping_list_items sli
        join shopping_lists sl on sl.id = sli.shopping_list_id
        where sl.household_id = $1
          and sli.id = $2
        limit 1
      `,
      [householdId, id]
    );

    return result.rows[0] ? this.mapItem(result.rows[0]) : null;
  }

  private async ensureShoppingState(householdId: string): Promise<void> {
    await this.database.transaction(async (client) => {
      await client.query(
        `
          insert into shopping_lists (household_id, type, name)
          values
            ($1, 'daily', 'Dzisiaj'),
            ($1, 'tomorrow', 'Jutro'),
            ($1, 'long_term', 'Na później'),
            ($1, 'pantry', 'Spiżarnia')
          on conflict (household_id, type) do nothing
        `,
        [householdId]
      );
      const today = await this.getWarsawDate(client);
      const rolloverResult = await client.query<{ last_rollover_date: string }>(
        `
          insert into shopping_rollovers (household_id, last_rollover_date)
          values ($1, $2)
          on conflict (household_id) do update
          set household_id = excluded.household_id
          returning last_rollover_date
        `,
        [householdId, today]
      );
      const lastRolloverDate = this.formatDateOnly(
        rolloverResult.rows[0]?.last_rollover_date ?? today
      );

      if (lastRolloverDate >= today) {
        return;
      }

      const dailyListId = await this.getListId(client, householdId, 'daily');
      const tomorrowListId = await this.getListId(client, householdId, 'tomorrow');
      await client.query(
        `
          delete from shopping_list_items
          where shopping_list_id = $1
            and is_checked = true
        `,
        [dailyListId]
      );

      const baseOrder = await this.nextDisplayOrder(client, dailyListId);
      await client.query(
        `
          with moved as (
            select
              id,
              row_number() over (order by display_order asc, created_at asc) - 1 as offset_order
            from shopping_list_items
            where shopping_list_id = $1
          )
          update shopping_list_items item
          set
            shopping_list_id = $2,
            display_order = $3 + moved.offset_order,
            is_checked = false,
            checked_at = null
          from moved
          where item.id = moved.id
        `,
        [tomorrowListId, dailyListId, baseOrder]
      );
      await client.query(
        `
          update shopping_rollovers
          set last_rollover_date = $2
          where household_id = $1
        `,
        [householdId, today]
      );
    });
  }

  private async getListId(
    client: PoolClient,
    householdId: string,
    type: ShoppingListType
  ): Promise<string> {
    const listResult = await client.query<{ id: string }>(
      `
        select id
        from shopping_lists
        where household_id = $1
          and type = $2
        limit 1
      `,
      [householdId, type]
    );
    const list = listResult.rows[0];

    if (!list) {
      throw new Error('Expected shopping list for household');
    }

    return list.id;
  }

  private async findDuplicateUncheckedItem(
    client: PoolClient,
    shoppingListId: string,
    normalizedName: string
  ): Promise<ShoppingItemRow | null> {
    const result = await client.query<ShoppingItemRow>(
      `
        select
          sli.id,
          sli.shopping_list_id,
          sl.household_id,
          sl.type,
          sli.name,
          sli.quantity,
          sli.category,
          sli.expiration_date,
          sli.encrypted_payload,
          sli.encryption_version,
          sli.is_checked,
          sli.checked_at,
          sli.display_order,
          sli.created_at,
          sli.updated_at
        from shopping_list_items sli
        join shopping_lists sl on sl.id = sli.shopping_list_id
        where sli.shopping_list_id = $1
          and sli.is_checked = false
        order by sli.display_order asc, sli.created_at asc
      `,
      [shoppingListId]
    );

    return (
      result.rows.find((row) => normalizeProductName(row.name) === normalizedName) ??
      null
    );
  }

  private async nextDisplayOrder(client: PoolClient, shoppingListId: string): Promise<number> {
    const result = await client.query<{ next_display_order: number }>(
      `
        select coalesce(max(display_order), -1) + 1 as next_display_order
        from shopping_list_items
        where shopping_list_id = $1
      `,
      [shoppingListId]
    );

    return result.rows[0]?.next_display_order ?? 0;
  }

  private async getWarsawDate(client: PoolClient): Promise<string> {
    const result = await client.query<{ today: string }>(
      "select timezone('Europe/Warsaw', now())::date::text as today"
    );

    return this.formatDateOnly(result.rows[0]?.today ?? new Date().toISOString());
  }

  private mapList(row: ShoppingListRow): ShoppingListRecord {
    return {
      createdAt: row.created_at,
      householdId: row.household_id,
      id: row.id,
      name: row.name,
      type: row.type,
      updatedAt: row.updated_at
    };
  }

  private mapItem(row: ShoppingItemRow): ShoppingItemRecord {
    return {
      checkedAt: row.checked_at,
      createdAt: row.created_at,
      category: row.category,
      displayOrder: row.display_order,
      encryptedPayload: row.encrypted_payload,
      encryptionEntity: 'shopping-item',
      encryptionVersion: row.encryption_version,
      expirationDate: row.expiration_date,
      householdId: row.household_id,
      id: row.id,
      isChecked: row.is_checked,
      name: row.name,
      quantity: row.quantity,
      shoppingListId: row.shopping_list_id,
      type: row.type,
      updatedAt: row.updated_at
    };
  }

  private mapItemOrThrow(row: ShoppingItemRow | undefined): ShoppingItemRecord {
    if (!row) {
      throw new Error('Expected shopping item record');
    }

    return this.mapItem(row);
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

function mergeQuantity(current: string, next: string | undefined): string {
  const normalizedNext = next?.trim();

  if (!normalizedNext || current.trim()) {
    return current;
  }

  return normalizedNext;
}

function normalizeShoppingCategory(value: string | undefined): ShoppingAiCategory | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  return SHOPPING_AI_CATEGORIES.includes(normalized as ShoppingAiCategory)
    ? (normalized as ShoppingAiCategory)
    : null;
}

function normalizeProductName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pl-PL')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singularizeToken)
    .join(' ');
}

function singularizeToken(value: string): string {
  if (value.endsWith('lka')) {
    return `${value.slice(0, -2)}ko`;
  }

  if (value.endsWith('ka')) {
    return `${value.slice(0, -2)}ko`;
  }

  if (value.endsWith('ki') || value.endsWith('y')) {
    return value.slice(0, -1);
  }

  return value;
}

interface ShoppingListRow {
  created_at: string;
  household_id: string;
  id: string;
  name: string;
  type: ShoppingListType;
  updated_at: string;
}

interface ShoppingItemRow {
  checked_at: string | null;
  category: ShoppingAiCategory | null;
  created_at: string;
  display_order: number;
  encrypted_payload: string | null;
  encryption_version: number | null;
  expiration_date: string | null;
  household_id: string;
  id: string;
  is_checked: boolean;
  name: string;
  quantity: string;
  shopping_list_id: string;
  type: ShoppingListType;
  updated_at: string;
}

export interface ShoppingListRecord {
  createdAt: string;
  householdId: string;
  id: string;
  name: string;
  type: ShoppingListType;
  updatedAt: string;
}

export interface ShoppingItemRecord {
  checkedAt: string | null;
  category: ShoppingAiCategory | null;
  createdAt: string;
  displayOrder: number;
  encryptedPayload: string | null;
  encryptionEntity: 'shopping-item';
  encryptionVersion: number | null;
  expirationDate: string | null;
  householdId: string;
  id: string;
  isChecked: boolean;
  name: string;
  quantity: string;
  shoppingListId: string;
  type: ShoppingListType;
  updatedAt: string;
}

export interface PantryDashboardRecord {
  items: ShoppingItemRecord[];
  stats: {
    expiringSoon: number;
    expired: number;
    shoppingList: number;
    total: number;
  };
}

export interface ShoppingAiImportResult {
  ignoredSourceFragments: Array<{
    id: string;
    reason: string;
  }>;
  importedCount: number;
  items: ShoppingItemRecord[];
  plannedItems: Array<{
    category: ShoppingAiCategory;
    name: string;
    quantity: string;
  }>;
  sourceFragments: ShoppingAiSourceFragment[];
}

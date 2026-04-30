import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CreateShoppingItemDto,
  ShoppingListType,
  UpdateShoppingItemDto
} from './dto/shopping.dto';

@Injectable()
export class ShoppingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async listShoppingLists(householdId: string): Promise<ShoppingListRecord[]> {
    const result = await this.database.query<ShoppingListRow>(
      `
        select id, household_id, type, name, created_at, updated_at
        from shopping_lists
        where household_id = $1
        order by
          case type
            when 'daily' then 0
            when 'long_term' then 1
            else 2
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
    const result = await this.database.query<ShoppingItemRow>(
      `
        select
          sli.id,
          sli.shopping_list_id,
          sl.household_id,
          sl.type,
          sli.name,
          sli.quantity,
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

  async createItem(
    householdId: string,
    type: ShoppingListType,
    dto: CreateShoppingItemDto
  ): Promise<ShoppingItemRecord> {
    const item = await this.database.transaction(async (client) => {
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

      const displayOrder = dto.displayOrder ?? (await this.nextDisplayOrder(client, list.id));
      const result = await client.query<ShoppingItemRow>(
        `
          insert into shopping_list_items (
            shopping_list_id,
            name,
            quantity,
            display_order
          )
          values ($1, $2, $3, $4)
          returning
            id,
            shopping_list_id,
            $5::uuid as household_id,
            $6::shopping_list_type as type,
            name,
            quantity,
            is_checked,
            checked_at,
            display_order,
            created_at,
            updated_at
        `,
        [list.id, dto.name.trim(), dto.quantity?.trim() ?? '', displayOrder, householdId, type]
      );

      const item = result.rows[0];

      if (!item) {
        throw new Error('Expected shopping item record');
      }

      return this.mapItem(item);
    });
    this.realtime.publish(householdId, 'shopping.changed', item.id);

    return item;
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
          display_order = $5
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
        dto.displayOrder ?? current.displayOrder
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
          checked_at = now()
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
      displayOrder: row.display_order,
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
  created_at: string;
  display_order: number;
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
  createdAt: string;
  displayOrder: number;
  householdId: string;
  id: string;
  isChecked: boolean;
  name: string;
  quantity: string;
  shoppingListId: string;
  type: ShoppingListType;
  updatedAt: string;
}

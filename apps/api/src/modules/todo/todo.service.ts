import { Injectable } from "@nestjs/common";
import { ScopeType, TodoStatus } from "@homeapp/shared-types";
import { DatabaseService } from "../database/database.service";
import { RealtimeService } from "../realtime/realtime.service";
import { CreateTodoItemDto, UpdateTodoItemDto } from "./dto/todo.dto";

@Injectable()
export class TodoService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService,
  ) {}

  async listItems(
    householdId: string,
    status?: TodoStatus,
  ): Promise<TodoItemRecord[]> {
    const result = await this.database.query<TodoItemRow>(
      `
        select
          id,
          household_id,
          scope_type,
          owner_member_id,
          title,
          description,
          status,
          created_at,
          updated_at
        from todo_items
        where household_id = $1
          and scope_type = 'household'
          and ($2::todo_status is null or status = $2)
        order by
          status asc,
          created_at desc
      `,
      [householdId, status ?? null],
    );

    return result.rows.map((row) => this.mapItem(row));
  }

  async createItem(
    householdId: string,
    dto: CreateTodoItemDto,
  ): Promise<TodoItemRecord> {
    const scopeType: ScopeType = "household";

    const result = await this.database.query<TodoItemRow>(
      `
        insert into todo_items (
          household_id,
          scope_type,
          owner_member_id,
          title,
          description
        )
        values ($1, $2, $3, $4, $5)
        returning
          id,
          household_id,
          scope_type,
          owner_member_id,
          title,
          description,
          status,
          created_at,
          updated_at
      `,
      [
        householdId,
        scopeType,
        null,
        dto.title.trim(),
        dto.description?.trim() ?? "",
      ],
    );

    const item = result.rows[0];

    if (!item) {
      throw new Error("Expected todo item record");
    }

    const mapped = this.mapItem(item);
    this.realtime.publish(householdId, "todo.changed", mapped.id);

    return mapped;
  }

  async updateItem(
    householdId: string,
    id: string,
    dto: UpdateTodoItemDto,
  ): Promise<TodoItemRecord | null> {
    const current = await this.findItem(householdId, id);

    if (!current) {
      return null;
    }

    const scopeType: ScopeType = "household";

    const result = await this.database.query<TodoItemRow>(
      `
        update todo_items
        set
          scope_type = $3,
          owner_member_id = $4,
          title = $5,
          description = $6,
          status = $7
        where household_id = $1
          and id = $2
        returning
          id,
          household_id,
          scope_type,
          owner_member_id,
          title,
          description,
          status,
          created_at,
          updated_at
      `,
      [
        householdId,
        id,
        scopeType,
        null,
        dto.title?.trim() ?? current.title,
        dto.description?.trim() ?? current.description,
        dto.status ?? current.status,
      ],
    );

    const item = result.rows[0] ? this.mapItem(result.rows[0]) : null;

    if (item) {
      this.realtime.publish(householdId, "todo.changed", item.id);
    }

    return item;
  }

  async setStatus(
    householdId: string,
    id: string,
    status: TodoStatus,
  ): Promise<TodoItemRecord | null> {
    const result = await this.database.query<TodoItemRow>(
      `
        update todo_items
        set status = $3
        where household_id = $1
          and id = $2
          and scope_type = 'household'
        returning
          id,
          household_id,
          scope_type,
          owner_member_id,
          title,
          description,
          status,
          created_at,
          updated_at
      `,
      [householdId, id, status],
    );

    const item = result.rows[0] ? this.mapItem(result.rows[0]) : null;

    if (item) {
      this.realtime.publish(householdId, "todo.changed", item.id);
    }

    return item;
  }

  async deleteItem(householdId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      `
        delete from todo_items
        where household_id = $1
          and id = $2
          and scope_type = 'household'
      `,
      [householdId, id],
    );

    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, "todo.changed", id);
    }

    return deleted;
  }

  private async findItem(
    householdId: string,
    id: string,
  ): Promise<TodoItemRecord | null> {
    const result = await this.database.query<TodoItemRow>(
      `
        select
          id,
          household_id,
          scope_type,
          owner_member_id,
          title,
          description,
          status,
          created_at,
          updated_at
        from todo_items
        where household_id = $1
          and id = $2
          and scope_type = 'household'
        limit 1
      `,
      [householdId, id],
    );

    return result.rows[0] ? this.mapItem(result.rows[0]) : null;
  }

  private mapItem(row: TodoItemRow): TodoItemRecord {
    return {
      createdAt: row.created_at,
      description: row.description,
      householdId: row.household_id,
      id: row.id,
      ownerMemberId: row.owner_member_id,
      scopeType: row.scope_type,
      status: row.status,
      title: row.title,
      updatedAt: row.updated_at,
    };
  }
}

interface TodoItemRow {
  created_at: string;
  description: string;
  household_id: string;
  id: string;
  owner_member_id: string | null;
  scope_type: ScopeType;
  status: TodoStatus;
  title: string;
  updated_at: string;
}

export interface TodoItemRecord {
  createdAt: string;
  description: string;
  householdId: string;
  id: string;
  ownerMemberId: string | null;
  scopeType: ScopeType;
  status: TodoStatus;
  title: string;
  updatedAt: string;
}

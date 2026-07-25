import { ScopeType, TodoStatus } from "@homeapp/shared-types";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from "class-validator";

export const TODO_STATUSES = ["todo", "done"] as const;
export const TODO_SCOPE_TYPES = ["household"] as const;
export const TODO_MOVE_DIRECTIONS = ["up", "down"] as const;

export class TodoItemIdParamDto {
  @IsUUID()
  id!: string;
}

export class ListTodoItemsQueryDto {
  @IsOptional()
  @IsIn([...TODO_STATUSES])
  status?: TodoStatus;
}

class EncryptedTodoItemDto {
  @IsOptional()
  @IsString()
  @Length(1, 50000)
  encryptedPayload?: string;

  @IsOptional()
  encryptionVersion?: number;
}

export class CreateTodoItemDto extends EncryptedTodoItemDto {
  @IsString()
  @Length(1, 180)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsIn([...TODO_SCOPE_TYPES])
  scopeType!: Extract<ScopeType, "household">;
}

export class UpdateTodoItemDto extends EncryptedTodoItemDto {
  @IsOptional()
  @IsString()
  @Length(1, 180)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsOptional()
  @IsIn([...TODO_SCOPE_TYPES])
  scopeType?: Extract<ScopeType, "household">;

  @IsOptional()
  @IsIn([...TODO_STATUSES])
  status?: TodoStatus;
}

export class MoveTodoItemDto {
  @IsIn([...TODO_MOVE_DIRECTIONS])
  direction!: "down" | "up";
}

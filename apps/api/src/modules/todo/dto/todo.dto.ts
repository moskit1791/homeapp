import { ScopeType, TodoStatus } from "@homeapp/shared-types";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateIf,
} from "class-validator";

export const TODO_STATUSES = ["todo", "done"] as const;
export const TODO_SCOPE_TYPES = ["household", "member"] as const;

export class TodoItemIdParamDto {
  @IsUUID()
  id!: string;
}

export class ListTodoItemsQueryDto {
  @IsOptional()
  @IsIn([...TODO_STATUSES])
  status?: TodoStatus;
}

export class CreateTodoItemDto {
  @IsString()
  @Length(1, 180)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsIn([...TODO_SCOPE_TYPES])
  scopeType!: ScopeType;

  @ValidateIf((dto: CreateTodoItemDto) => dto.scopeType === "member")
  @IsUUID()
  ownerMemberId?: string;
}

export class UpdateTodoItemDto {
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
  scopeType?: ScopeType;

  @IsOptional()
  @IsUUID()
  ownerMemberId?: string;

  @IsOptional()
  @IsIn([...TODO_STATUSES])
  status?: TodoStatus;
}

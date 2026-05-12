import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export const SHOPPING_LIST_TYPES = ['daily', 'tomorrow', 'long_term'] as const;

export type ShoppingListType = (typeof SHOPPING_LIST_TYPES)[number];

export class ShoppingListTypeParamDto {
  @IsIn([...SHOPPING_LIST_TYPES])
  type!: ShoppingListType;
}

export class ShoppingItemIdParamDto {
  @IsUUID()
  id!: string;
}

export class CreateShoppingItemDto {
  @IsString()
  @Length(1, 180)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  quantity?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateShoppingItemDto {
  @IsOptional()
  @IsString()
  @Length(1, 180)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  quantity?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class MoveShoppingItemDto {
  @IsIn([...SHOPPING_LIST_TYPES])
  targetType!: ShoppingListType;
}

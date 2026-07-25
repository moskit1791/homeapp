import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min
} from 'class-validator';

export const SHOPPING_LIST_TYPES = ['daily', 'tomorrow', 'long_term', 'pantry'] as const;

export type ShoppingListType = (typeof SHOPPING_LIST_TYPES)[number];

export class ShoppingListTypeParamDto {
  @IsIn([...SHOPPING_LIST_TYPES])
  type!: ShoppingListType;
}

export class ShoppingItemIdParamDto {
  @IsUUID()
  id!: string;
}

class EncryptedShoppingItemDto {
  @IsOptional()
  @IsString()
  @Length(1, 50000)
  encryptedPayload?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  encryptionVersion?: number;
}

export class CreateShoppingItemDto extends EncryptedShoppingItemDto {
  @IsString()
  @Length(1, 180)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  quantity?: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  category?: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateShoppingItemDto extends EncryptedShoppingItemDto {
  @IsOptional()
  @IsString()
  @Length(1, 180)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  quantity?: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  category?: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class MoveShoppingItemDto {
  @IsIn([...SHOPPING_LIST_TYPES])
  targetType!: ShoppingListType;
}

export class ImportShoppingItemsWithAiDto {
  @IsString()
  @Length(3, 5000)
  message!: string;

  @IsOptional()
  @IsBoolean()
  planOnly?: boolean;
}

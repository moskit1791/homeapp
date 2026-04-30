import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min
} from 'class-validator';
import { Type } from 'class-transformer';

export class FinanceMonthIdParamDto {
  @IsUUID()
  id!: string;
}

export class FinanceMemberIdParamDto {
  @IsUUID()
  memberId!: string;
}

export class FinanceCategoryIdParamDto {
  @IsUUID()
  id!: string;
}

export class FinanceBudgetItemIdParamDto {
  @IsUUID()
  id!: string;
}

export class FinanceExpenseIdParamDto {
  @IsUUID()
  id!: string;
}

export class CreateBudgetCategoryDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  copyBudgetToNextMonth?: boolean;
}

export class UpdateBudgetCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  copyBudgetToNextMonth?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateBudgetItemDto {
  @IsUUID()
  budgetMonthId!: string;

  @IsUUID()
  ownerMemberId!: string;

  @IsUUID()
  categoryId!: string;

  @IsString()
  @Length(1, 160)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetAmount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateBudgetItemDto {
  @IsOptional()
  @IsUUID()
  ownerMemberId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetAmount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class CreateExpenseDto {
  @IsUUID()
  budgetItemId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}

export class UpsertIncomeDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;
}

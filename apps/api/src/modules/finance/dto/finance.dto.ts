import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsInt,
  IsIn,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Matches,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class FinanceEncryptedPayloadDto {
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  encryptedPayload?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  encryptionVersion?: number;
}

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

export class FinanceDebtIdParamDto {
  @IsUUID()
  id!: string;
}

export class FinanceSavingsAccountIdParamDto {
  @IsUUID()
  id!: string;
}

export class CreateBudgetMonthDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  month!: number;

  @IsOptional()
  @IsUUID()
  sourceBudgetMonthId?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year!: number;
}

export class GenerateNextBudgetMonthCopyItemDto extends FinanceEncryptedPayloadDto {
  @IsUUID()
  budgetItemId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetAmount?: number | null;
}

export class GenerateNextBudgetMonthCategoryDto {
  @IsUUID()
  categoryId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder!: number;
}

export class GenerateNextBudgetMonthDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => GenerateNextBudgetMonthCategoryDto)
  categories?: GenerateNextBudgetMonthCategoryDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => GenerateNextBudgetMonthCopyItemDto)
  items?: GenerateNextBudgetMonthCopyItemDto[];
}

export class CreateBudgetCategoryDto extends FinanceEncryptedPayloadDto {
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

export class UpdateBudgetCategoryDto extends FinanceEncryptedPayloadDto {
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

export class CreateBudgetItemDto extends FinanceEncryptedPayloadDto {
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

export class UpdateBudgetItemDto extends FinanceEncryptedPayloadDto {
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

export class CreateExpenseDto extends FinanceEncryptedPayloadDto {
  @IsUUID()
  budgetItemId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;
}

export class ImportExpenseItemDto extends FinanceEncryptedPayloadDto {
  @IsUUID()
  clientId!: string;

  @IsUUID()
  budgetItemId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  originalAmount?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  originalCurrency?: string;

  @IsUUID()
  sourceExternalId!: string;
}

export class ImportExpensesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ImportExpenseItemDto)
  items!: ImportExpenseItemDto[];
}

export class UpsertIncomeDto extends FinanceEncryptedPayloadDto {
  @IsOptional()
  @IsUUID()
  budgetMonthId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;
}

export class CreateFinanceDebtDto extends FinanceEncryptedPayloadDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsString()
  @Length(1, 160)
  lenderName!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string | null;

  @IsString()
  @Length(1, 200)
  purpose!: string;
}

export class UpdateFinanceDebtDto extends FinanceEncryptedPayloadDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isSettled?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  lenderName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  purpose?: string;
}

export class CreateFinanceDebtPaymentDto extends FinanceEncryptedPayloadDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string | null;
}

export class CreateFinanceSavingsAccountDto extends FinanceEncryptedPayloadDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsDateString()
  changedAt?: string;

  @IsOptional()
  @IsUUID()
  ownerMemberId?: string | null;

  @IsString()
  @Length(1, 160)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  targetAmount?: number | null;

  @IsOptional()
  @IsDateString()
  targetDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  transactionEncryptedPayload?: string;
}

export class CreateFinanceSavingsTransactionDto extends FinanceEncryptedPayloadDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsDateString()
  changedAt?: string;

  @IsIn(['add', 'subtract'])
  direction!: 'add' | 'subtract';

  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string | null;
}

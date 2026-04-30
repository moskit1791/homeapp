import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class AnnualCostIdParamDto {
  @IsUUID()
  id!: string;
}

export class AnnualCostHistoryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  year!: number;
}

export class CreateAnnualCostDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @Matches(DATE_PATTERN)
  nextDueDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  defaultAmount?: number | null;
}

export class UpdateAnnualCostDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @Matches(DATE_PATTERN)
  nextDueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  defaultAmount?: number | null;
}

export class CompleteAnnualCostDto {
  @Matches(DATE_PATTERN)
  executedAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number | null;
}

import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class MealPlanIdParamDto {
  @IsUUID()
  id!: string;
}

export class MealIdeaIdParamDto {
  @IsUUID()
  id!: string;
}

export class CreateMealPlanDto {
  @IsDateString({ strict: true })
  weekStartDate!: string;
}

export class MealPlanEntryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  slotIndex!: number;

  @IsString()
  @Length(1, 180)
  mealName!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  linkUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class UpdateMealPlanDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MealPlanEntryDto)
  entries!: MealPlanEntryDto[];
}

export class CopyMealPlanDto {
  @IsDateString({ strict: true })
  targetWeekStartDate!: string;
}

export class RandomizeMealPlanDto {
  @IsOptional()
  @IsDateString({ strict: true })
  targetWeekStartDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  weekday?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  slotIndex?: number;
}

export class CreateMealIdeaDto {
  @IsString()
  @Length(1, 180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  linkUrl?: string | null;
}

export class UpdateMealIdeaDto {
  @IsOptional()
  @IsString()
  @Length(1, 180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  linkUrl?: string | null;
}

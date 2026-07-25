import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsIn,
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

export class MealPlanEntryTargetDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  slotIndex!: number;
}

export class MealIdeaIdParamDto {
  @IsUUID()
  id!: string;
}

export class CreateMealPlanDto {
  @IsDateString({ strict: true })
  weekStartDate!: string;
}

class EncryptedMealPlannerDto {
  @IsOptional()
  @IsString()
  @Length(1, 50000)
  encryptedPayload?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  encryptionVersion?: number;
}

export class MealPlanEntryDto extends EncryptedMealPlannerDto {
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

export class MealPlanAiMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @Length(1, 4000)
  content!: string;
}

export class MealPlanAiDraftEntryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(7)
  slotIndex!: number;

  @IsString()
  @Length(1, 180)
  mealName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sourceHint?: string | null;
}

export class MealPlanAiChatDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MealPlanAiMessageDto)
  messages!: MealPlanAiMessageDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(56)
  @ValidateNested({ each: true })
  @Type(() => MealPlanAiDraftEntryDto)
  currentDraft?: MealPlanAiDraftEntryDto[];

  @IsDateString({ strict: true })
  targetWeekStartDate!: string;
}

export class MealPlanAiFinalizeDto extends MealPlanAiChatDto {}

export class MealPlanAiSuggestDto {
  @IsDateString({ strict: true })
  targetWeekStartDate!: string;
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

export class CreateMealIdeaDto extends EncryptedMealPlannerDto {
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

export class UpdateMealIdeaDto extends EncryptedMealPlannerDto {
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

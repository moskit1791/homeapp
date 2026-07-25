import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CleaningFrequencyMode } from '@homeapp/shared-types';

export const CLEANING_FREQUENCY_MODES = ['preset', 'custom_days'] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CleaningTaskIdParamDto {
  @IsUUID()
  id!: string;
}

class EncryptedCleaningTaskDto {
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

export class CreateCleaningTaskDto extends EncryptedCleaningTaskDto {
  @IsString()
  @Length(1, 180)
  name!: string;

  @IsIn([...CLEANING_FREQUENCY_MODES])
  frequencyMode!: CleaningFrequencyMode;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  frequencyDays!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  completionWindowDays?: number;

  @Matches(DATE_PATTERN)
  nextDueAt!: string;

  @IsOptional()
  @IsString()
  @Length(1, 180)
  location?: string;
}

export class UpdateCleaningTaskDto extends EncryptedCleaningTaskDto {
  @IsOptional()
  @IsString()
  @Length(1, 180)
  name?: string;

  @IsOptional()
  @IsIn([...CLEANING_FREQUENCY_MODES])
  frequencyMode?: CleaningFrequencyMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  frequencyDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  completionWindowDays?: number;

  @IsOptional()
  @Matches(DATE_PATTERN)
  nextDueAt?: string;

  @IsOptional()
  @IsString()
  @Length(1, 180)
  location?: string;
}

export class CompleteCleaningTaskDto {
  @IsOptional()
  @Matches(DATE_PATTERN)
  completedAt?: string;
}

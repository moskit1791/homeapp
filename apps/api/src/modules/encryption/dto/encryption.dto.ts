import {
  ENCRYPTABLE_MODULE_KEYS,
  EncryptableModuleKey,
} from "@homeapp/shared-types";
import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export const ENCRYPTION_MIGRATION_ENTITIES = [
  "calendar-event",
  "budget-category",
  "budget-item",
  "expense",
  "income",
  "finance-debt",
  "finance-debt-payment",
  "finance-savings-account",
  "finance-savings-transaction",
  "meal-plan-entry",
  "meal-idea",
  "shopping-item",
  "todo-item",
  "note-item",
  "cleaning-task",
  "annual-cost",
  "annual-cost-history",
  "data-entry",
  "attachment",
] as const;

export type EncryptionMigrationEntity =
  (typeof ENCRYPTION_MIGRATION_ENTITIES)[number];

export class EncryptionModuleParamDto {
  @IsIn([...ENCRYPTABLE_MODULE_KEYS])
  module!: EncryptableModuleKey;
}

export class EncryptionMigrationItemDto {
  @IsIn([...ENCRYPTION_MIGRATION_ENTITIES])
  entity!: EncryptionMigrationEntity;

  @IsUUID()
  id!: string;

  @IsUUID()
  sourceRevision!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  encryptedPayload?: string;

  @IsOptional()
  @IsObject()
  plaintextPayload?: Record<string, unknown>;

  @IsInt()
  @Min(1)
  encryptionVersion!: number;
}

export class UpdateHouseholdEncryptionDto {
  @IsArray()
  @ArrayUnique()
  @IsIn([...ENCRYPTABLE_MODULE_KEYS], { each: true })
  enabledModules!: EncryptableModuleKey[];

  @IsInt()
  @Min(1)
  keyVersion!: number;

  @IsString()
  @Length(32, 256)
  kdfSalt!: string;

  @IsString()
  @MaxLength(4096)
  wrappedKey!: string;

  @IsString()
  @MaxLength(4096)
  recoveryWrappedKey!: string;

  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EncryptionMigrationItemDto)
  migrationItems?: EncryptionMigrationItemDto[];
}

export class RemoveHouseholdEncryptionDto {
  @IsISO8601()
  expectedUpdatedAt!: string;

  @IsInt()
  @Min(1)
  keyVersion!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EncryptionMigrationItemDto)
  migrationItems?: EncryptionMigrationItemDto[];
}

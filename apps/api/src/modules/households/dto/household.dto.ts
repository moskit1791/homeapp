import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { MODULE_KEYS, ModuleKey } from '@homeapp/shared-types';

export class CreateHouseholdDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  mealSlotsPerDay?: number;
}

export class UpdateHouseholdDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  mealSlotsPerDay?: number;
}

export class InviteMemberDto {
  @IsEmail()
  email!: string;
}

export class MemberPermissionDto {
  @IsIn([...MODULE_KEYS])
  moduleKey!: ModuleKey;

  @IsBoolean()
  canRead!: boolean;

  @IsBoolean()
  canCreate!: boolean;

  @IsBoolean()
  canUpdate!: boolean;

  @IsBoolean()
  canDelete!: boolean;
}

export class PatchMemberPermissionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MemberPermissionDto)
  permissions!: MemberPermissionDto[];
}

export class MemberIdParamDto {
  @IsUUID()
  id!: string;
}

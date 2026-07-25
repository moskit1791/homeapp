import { IsInt, IsOptional, IsString, IsUUID, Length, MaxLength, Min } from 'class-validator';

export class DataEntrySearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

class EncryptedDataEntryDto {
  @IsOptional()
  @IsString()
  @Length(1, 50000)
  encryptedPayload?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  encryptionVersion?: number;
}

export class CreateDataEntryDto extends EncryptedDataEntryDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsString()
  @MaxLength(10000)
  value!: string;
}

export class UpdateDataEntryDto extends EncryptedDataEntryDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  value?: string;
}

export class DataEntryIdParamDto {
  @IsUUID()
  id!: string;
}

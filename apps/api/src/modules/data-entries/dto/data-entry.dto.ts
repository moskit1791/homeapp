import { IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

export class DataEntrySearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class CreateDataEntryDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsString()
  @MaxLength(10000)
  value!: string;
}

export class UpdateDataEntryDto {
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

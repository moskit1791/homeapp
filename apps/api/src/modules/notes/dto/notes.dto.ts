import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from "class-validator";

class EncryptedNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  encryptedPayload?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  encryptionVersion?: number;
}

export class NoteIdParamDto {
  @IsUUID()
  id!: string;
}

export class CreateNoteDto extends EncryptedNoteDto {
  @IsString()
  @Length(1, 180)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  description?: string;
}

export class UpdateNoteDto extends EncryptedNoteDto {
  @IsOptional()
  @IsString()
  @Length(1, 180)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  description?: string;
}

import { IsOptional, IsString, IsUUID, Length } from "class-validator";

export class NoteIdParamDto {
  @IsUUID()
  id!: string;
}

export class CreateNoteDto {
  @IsString()
  @Length(1, 180)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  description?: string;
}

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  @Length(1, 180)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  description?: string;
}

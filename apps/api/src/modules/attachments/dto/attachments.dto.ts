import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

export const ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
] as const;

export type AttachmentMimeType = (typeof ATTACHMENT_MIME_TYPES)[number];

export class AttachmentIdParamDto {
  @IsUUID()
  id!: string;
}

export class ListAttachmentsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class CreateAttachmentUploadUrlDto {
  @IsString()
  @Length(1, 255)
  fileName!: string;

  @IsIn([...ATTACHMENT_MIME_TYPES])
  mimeType!: AttachmentMimeType;
}

export class CreateAttachmentDto {
  @IsString()
  @Length(1, 1000)
  storagePath!: string;

  @IsIn([...ATTACHMENT_MIME_TYPES])
  mimeType!: AttachmentMimeType;

  @IsString()
  @Length(1, 255)
  fileName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caption?: string;
}

export class UpdateAttachmentDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caption?: string;
}

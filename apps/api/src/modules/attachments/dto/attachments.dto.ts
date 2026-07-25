import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, MaxLength, Min } from 'class-validator';

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

class EncryptedAttachmentDto {
  @IsOptional()
  @IsString()
  @Length(1, 50000)
  encryptedPayload?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  encryptionVersion?: number;
}

export class CreateAttachmentDto extends EncryptedAttachmentDto {
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

export class LocalAttachmentUploadDto {
  @IsString()
  @Length(1, 1000)
  storagePath!: string;

  @IsIn([...ATTACHMENT_MIME_TYPES])
  mimeType!: AttachmentMimeType;
}

export class UpdateAttachmentDto extends EncryptedAttachmentDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caption?: string;
}

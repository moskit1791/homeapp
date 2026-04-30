import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from '../../shared/env';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  AttachmentMimeType,
  CreateAttachmentDto,
  CreateAttachmentUploadUrlDto,
  UpdateAttachmentDto
} from './dto/attachments.dto';

@Injectable()
export class AttachmentsService {
  private readonly localStorageRoot = path.resolve(loadEnv().LOCAL_STORAGE_ROOT);

  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async listAttachments(
    householdId: string,
    search: string | undefined
  ): Promise<AttachmentRecord[]> {
    const normalizedSearch = this.normalizeSearch(search);
    const result = await this.database.query<AttachmentRow>(
      `
        select
          id,
          household_id,
          storage_path,
          mime_type,
          file_name,
          caption,
          created_by_member_id,
          created_at,
          updated_at
        from attachments
        where household_id = $1
          and ($2::text is null or caption ilike '%' || $2 || '%')
        order by created_at desc
      `,
      [householdId, normalizedSearch]
    );

    return result.rows.map((row) => this.mapAttachment(row));
  }

  createUploadContract(
    householdId: string,
    dto: CreateAttachmentUploadUrlDto
  ): AttachmentUploadContract {
    const fileName = this.normalizeFileName(dto.fileName);
    const storagePath = this.buildStoragePath(householdId, fileName);

    return {
      fileName,
      method: 'POST',
      mimeType: dto.mimeType,
      storagePath,
      uploadUrl: '/api/attachments/local-upload'
    };
  }

  async createAttachment(
    householdId: string,
    memberId: string,
    dto: CreateAttachmentDto
  ): Promise<AttachmentRecord> {
    const storagePath = this.normalizeStoragePath(householdId, dto.storagePath);
    const result = await this.database.query<AttachmentRow>(
      `
        insert into attachments (
          household_id,
          storage_path,
          mime_type,
          file_name,
          caption,
          created_by_member_id
        )
        values ($1, $2, $3, $4, $5, $6)
        returning
          id,
          household_id,
          storage_path,
          mime_type,
          file_name,
          caption,
          created_by_member_id,
          created_at,
          updated_at
      `,
      [
        householdId,
        storagePath,
        dto.mimeType,
        this.normalizeFileName(dto.fileName),
        this.normalizeCaption(dto.caption),
        memberId
      ]
    );

    const attachment = result.rows[0];

    if (!attachment) {
      throw new Error('Expected attachment record');
    }

    const mapped = this.mapAttachment(attachment);
    this.realtime.publish(householdId, 'attachment.changed', mapped.id);

    return mapped;
  }

  async updateAttachment(
    householdId: string,
    id: string,
    dto: UpdateAttachmentDto
  ): Promise<AttachmentRecord | null> {
    if (dto.caption === undefined && dto.fileName === undefined) {
      throw new BadRequestException('No attachment fields to update');
    }

    const current = await this.findAttachment(householdId, id);

    if (!current) {
      return null;
    }

    const result = await this.database.query<AttachmentRow>(
      `
        update attachments
        set
          file_name = $3,
          caption = $4
        where household_id = $1
          and id = $2
        returning
          id,
          household_id,
          storage_path,
          mime_type,
          file_name,
          caption,
          created_by_member_id,
          created_at,
          updated_at
      `,
      [
        householdId,
        id,
        dto.fileName === undefined ? current.fileName : this.normalizeFileName(dto.fileName),
        dto.caption === undefined ? current.caption : this.normalizeCaption(dto.caption)
      ]
    );

    const attachment = result.rows[0] ? this.mapAttachment(result.rows[0]) : null;

    if (attachment) {
      this.realtime.publish(householdId, 'attachment.changed', attachment.id);
    }

    return attachment;
  }

  async deleteAttachment(householdId: string, id: string): Promise<boolean> {
    const current = await this.findAttachment(householdId, id);

    if (!current) {
      return false;
    }

    const result = await this.database.query(
      `
        delete from attachments
        where household_id = $1
          and id = $2
      `,
      [householdId, id]
    );

    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      await this.deleteLocalFileIfSafe(current.storagePath);
      this.realtime.publish(householdId, 'attachment.changed', id);
    }

    return deleted;
  }

  private async findAttachment(
    householdId: string,
    id: string
  ): Promise<AttachmentRecord | null> {
    const result = await this.database.query<AttachmentRow>(
      `
        select
          id,
          household_id,
          storage_path,
          mime_type,
          file_name,
          caption,
          created_by_member_id,
          created_at,
          updated_at
        from attachments
        where household_id = $1
          and id = $2
        limit 1
      `,
      [householdId, id]
    );

    return result.rows[0] ? this.mapAttachment(result.rows[0]) : null;
  }

  private async deleteLocalFileIfSafe(storagePath: string): Promise<void> {
    const absolutePath = path.resolve(this.localStorageRoot, storagePath);
    const relativePath = path.relative(this.localStorageRoot, absolutePath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return;
    }

    try {
      await unlink(absolutePath);
    } catch (error) {
      if (!this.isMissingFileError(error)) {
        throw error;
      }
    }
  }

  private buildStoragePath(householdId: string, fileName: string): string {
    return path.posix.join(
      'households',
      householdId,
      'attachments',
      `${randomUUID()}-${this.toStorageFileName(fileName)}`
    );
  }

  private normalizeStoragePath(householdId: string, storagePath: string): string {
    const normalized = storagePath.replace(/\\/g, '/').trim();
    const posixNormalized = path.posix.normalize(normalized);
    const expectedPrefix = `households/${householdId}/attachments/`;

    if (
      !normalized ||
      normalized.startsWith('/') ||
      posixNormalized.startsWith('../') ||
      posixNormalized === '..' ||
      posixNormalized !== normalized ||
      !posixNormalized.startsWith(expectedPrefix)
    ) {
      throw new BadRequestException('Invalid attachment storage path');
    }

    return posixNormalized;
  }

  private normalizeFileName(fileName: string): string {
    const normalized = fileName.trim();

    if (!normalized) {
      throw new BadRequestException('Attachment fileName is required');
    }

    return normalized;
  }

  private normalizeCaption(caption: string | undefined): string {
    return caption?.trim() ?? '';
  }

  private normalizeSearch(search: string | undefined): string | null {
    const normalized = search?.trim();
    return normalized ? normalized : null;
  }

  private toStorageFileName(fileName: string): string {
    const parsed = path.parse(fileName);
    const extension = parsed.ext.toLowerCase().replace(/[^a-z0-9.]/g, '');
    const baseName = parsed.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `${baseName || 'file'}${extension}`;
  }

  private isMissingFileError(error: unknown): boolean {
    return Boolean(
      error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'ENOENT'
    );
  }

  private mapAttachment(row: AttachmentRow): AttachmentRecord {
    return {
      caption: row.caption,
      createdAt: row.created_at,
      createdByMemberId: row.created_by_member_id,
      fileName: row.file_name,
      householdId: row.household_id,
      id: row.id,
      mimeType: row.mime_type,
      storagePath: row.storage_path,
      updatedAt: row.updated_at
    };
  }
}

interface AttachmentRow {
  caption: string;
  created_at: string;
  created_by_member_id: string | null;
  file_name: string;
  household_id: string;
  id: string;
  mime_type: AttachmentMimeType;
  storage_path: string;
  updated_at: string;
}

export interface AttachmentRecord {
  caption: string;
  createdAt: string;
  createdByMemberId: string | null;
  fileName: string;
  householdId: string;
  id: string;
  mimeType: AttachmentMimeType;
  storagePath: string;
  updatedAt: string;
}

export interface AttachmentUploadContract {
  fileName: string;
  method: 'POST';
  mimeType: AttachmentMimeType;
  storagePath: string;
  uploadUrl: '/api/attachments/local-upload';
}

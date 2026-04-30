import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateDataEntryDto, UpdateDataEntryDto } from './dto/data-entry.dto';

@Injectable()
export class DataEntriesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async listEntries(householdId: string, search?: string): Promise<DataEntryRecord[]> {
    const normalizedSearch = search?.trim();
    const values = normalizedSearch
      ? [householdId, `%${this.escapeLikePattern(normalizedSearch)}%`]
      : [householdId];
    const result = await this.database.query<DataEntryRow>(
      `
        select id, household_id, title, value, created_at, updated_at
        from data_entries
        where household_id = $1
          ${
            normalizedSearch
              ? "and (title ilike $2 escape '\\' or value ilike $2 escape '\\')"
              : ''
          }
        order by updated_at desc
      `,
      values
    );

    return result.rows.map((row) => this.mapEntry(row));
  }

  async createEntry(householdId: string, dto: CreateDataEntryDto): Promise<DataEntryRecord> {
    const title = this.normalizeTitle(dto.title);
    const result = await this.database.query<DataEntryRow>(
      `
        insert into data_entries (
          household_id,
          title,
          value
        )
        values ($1, $2, $3)
        returning id, household_id, title, value, created_at, updated_at
      `,
      [householdId, title, dto.value]
    );

    const entry = this.mapEntry(result.rows[0]);
    this.realtime.publish(householdId, 'data.changed', entry.id);

    return entry;
  }

  async updateEntry(
    householdId: string,
    entryId: string,
    dto: UpdateDataEntryDto
  ): Promise<DataEntryRecord | null> {
    if (dto.title === undefined && dto.value === undefined) {
      throw new BadRequestException('No data entry fields to update');
    }

    const result = await this.database.query<DataEntryRow>(
      `
        update data_entries
        set
          title = coalesce($3, title),
          value = coalesce($4, value)
        where household_id = $1
          and id = $2
        returning id, household_id, title, value, created_at, updated_at
      `,
      [
        householdId,
        entryId,
        dto.title === undefined ? null : this.normalizeTitle(dto.title),
        dto.value ?? null
      ]
    );

    const row = result.rows[0];

    const entry = row ? this.mapEntry(row) : null;

    if (entry) {
      this.realtime.publish(householdId, 'data.changed', entry.id);
    }

    return entry;
  }

  async deleteEntry(householdId: string, entryId: string): Promise<boolean> {
    const result = await this.database.query(
      `
        delete from data_entries
        where household_id = $1
          and id = $2
      `,
      [householdId, entryId]
    );

    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, 'data.changed', entryId);
    }

    return deleted;
  }

  private normalizeTitle(title: string): string {
    const normalized = title.trim();

    if (!normalized) {
      throw new BadRequestException('Data entry title is required');
    }

    return normalized;
  }

  private escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`);
  }

  private mapEntry(row: DataEntryRow | undefined): DataEntryRecord {
    if (!row) {
      throw new Error('Expected data entry record');
    }

    return {
      createdAt: row.created_at,
      householdId: row.household_id,
      id: row.id,
      title: row.title,
      updatedAt: row.updated_at,
      value: row.value
    };
  }
}

interface DataEntryRow {
  created_at: string;
  household_id: string;
  id: string;
  title: string;
  updated_at: string;
  value: string;
}

export interface DataEntryRecord {
  createdAt: string;
  householdId: string;
  id: string;
  title: string;
  updatedAt: string;
  value: string;
}

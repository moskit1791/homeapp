import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { RealtimeService } from "../realtime/realtime.service";
import { CreateNoteDto, UpdateNoteDto } from "./dto/notes.dto";

@Injectable()
export class NotesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService,
  ) {}

  async listNotes(householdId: string, ownerMemberId: string): Promise<NoteRecord[]> {
    const result = await this.database.query<NoteRow>(
      `
        select
          id,
          household_id,
          owner_member_id,
          title,
          description,
          created_at,
          updated_at
        from note_items
        where household_id = $1
          and owner_member_id = $2
        order by updated_at desc
      `,
      [householdId, ownerMemberId],
    );

    return result.rows.map((row) => this.mapNote(row));
  }

  async createNote(
    householdId: string,
    ownerMemberId: string,
    dto: CreateNoteDto,
  ): Promise<NoteRecord> {
    const result = await this.database.query<NoteRow>(
      `
        insert into note_items (
          household_id,
          owner_member_id,
          title,
          description
        )
        values ($1, $2, $3, $4)
        returning
          id,
          household_id,
          owner_member_id,
          title,
          description,
          created_at,
          updated_at
      `,
      [householdId, ownerMemberId, dto.title.trim(), dto.description?.trim() ?? ""],
    );

    const note = result.rows[0];

    if (!note) {
      throw new Error("Expected note record");
    }

    const mapped = this.mapNote(note);
    this.realtime.publish(householdId, "note.changed", mapped.id);

    return mapped;
  }

  async updateNote(
    householdId: string,
    ownerMemberId: string,
    id: string,
    dto: UpdateNoteDto,
  ): Promise<NoteRecord | null> {
    const current = await this.findNote(householdId, ownerMemberId, id);

    if (!current) {
      return null;
    }

    const result = await this.database.query<NoteRow>(
      `
        update note_items
        set
          title = $4,
          description = $5
        where household_id = $1
          and id = $2
          and owner_member_id = $3
        returning
          id,
          household_id,
          owner_member_id,
          title,
          description,
          created_at,
          updated_at
      `,
      [
        householdId,
        id,
        ownerMemberId,
        dto.title?.trim() ?? current.title,
        dto.description?.trim() ?? current.description,
      ],
    );

    const note = result.rows[0] ? this.mapNote(result.rows[0]) : null;

    if (note) {
      this.realtime.publish(householdId, "note.changed", note.id);
    }

    return note;
  }

  async deleteNote(householdId: string, ownerMemberId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      `
        delete from note_items
        where household_id = $1
          and id = $2
          and owner_member_id = $3
      `,
      [householdId, id, ownerMemberId],
    );

    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, "note.changed", id);
    }

    return deleted;
  }

  private async findNote(
    householdId: string,
    ownerMemberId: string,
    id: string,
  ): Promise<NoteRecord | null> {
    const result = await this.database.query<NoteRow>(
      `
        select
          id,
          household_id,
          owner_member_id,
          title,
          description,
          created_at,
          updated_at
        from note_items
        where household_id = $1
          and id = $2
          and owner_member_id = $3
        limit 1
      `,
      [householdId, id, ownerMemberId],
    );

    return result.rows[0] ? this.mapNote(result.rows[0]) : null;
  }

  private mapNote(row: NoteRow): NoteRecord {
    return {
      createdAt: row.created_at,
      description: row.description,
      householdId: row.household_id,
      id: row.id,
      ownerMemberId: row.owner_member_id,
      title: row.title,
      updatedAt: row.updated_at,
    };
  }
}

interface NoteRow {
  created_at: string;
  description: string;
  household_id: string;
  id: string;
  owner_member_id: string;
  title: string;
  updated_at: string;
}

export interface NoteRecord {
  createdAt: string;
  description: string;
  householdId: string;
  id: string;
  ownerMemberId: string;
  title: string;
  updatedAt: string;
}

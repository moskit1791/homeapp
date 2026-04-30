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

  async listNotes(householdId: string): Promise<NoteRecord[]> {
    const result = await this.database.query<NoteRow>(
      `
        select
          id,
          household_id,
          title,
          description,
          created_at,
          updated_at
        from note_items
        where household_id = $1
        order by created_at desc
      `,
      [householdId],
    );

    return result.rows.map((row) => this.mapNote(row));
  }

  async createNote(
    householdId: string,
    dto: CreateNoteDto,
  ): Promise<NoteRecord> {
    const result = await this.database.query<NoteRow>(
      `
        insert into note_items (
          household_id,
          title,
          description
        )
        values ($1, $2, $3)
        returning
          id,
          household_id,
          title,
          description,
          created_at,
          updated_at
      `,
      [householdId, dto.title.trim(), dto.description?.trim() ?? ""],
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
    id: string,
    dto: UpdateNoteDto,
  ): Promise<NoteRecord | null> {
    const current = await this.findNote(householdId, id);

    if (!current) {
      return null;
    }

    const result = await this.database.query<NoteRow>(
      `
        update note_items
        set
          title = $3,
          description = $4
        where household_id = $1
          and id = $2
        returning
          id,
          household_id,
          title,
          description,
          created_at,
          updated_at
      `,
      [
        householdId,
        id,
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

  async deleteNote(householdId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      `
        delete from note_items
        where household_id = $1
          and id = $2
      `,
      [householdId, id],
    );

    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, "note.changed", id);
    }

    return deleted;
  }

  private async findNote(
    householdId: string,
    id: string,
  ): Promise<NoteRecord | null> {
    const result = await this.database.query<NoteRow>(
      `
        select
          id,
          household_id,
          title,
          description,
          created_at,
          updated_at
        from note_items
        where household_id = $1
          and id = $2
        limit 1
      `,
      [householdId, id],
    );

    return result.rows[0] ? this.mapNote(result.rows[0]) : null;
  }

  private mapNote(row: NoteRow): NoteRecord {
    return {
      createdAt: row.created_at,
      description: row.description,
      householdId: row.household_id,
      id: row.id,
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
  title: string;
  updated_at: string;
}

export interface NoteRecord {
  createdAt: string;
  description: string;
  householdId: string;
  id: string;
  title: string;
  updatedAt: string;
}

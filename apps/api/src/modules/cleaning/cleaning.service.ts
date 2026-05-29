import { BadRequestException, Injectable } from '@nestjs/common';
import { CleaningFrequencyMode } from '@homeapp/shared-types';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CompleteCleaningTaskDto,
  CreateCleaningTaskDto,
  UpdateCleaningTaskDto
} from './dto/cleaning.dto';

@Injectable()
export class CleaningService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async listTasks(householdId: string): Promise<CleaningTaskRecord[]> {
    const result = await this.database.query<CleaningTaskRow>(
      `
        select
          ct.id,
          ct.household_id,
          ct.name,
          ct.frequency_mode,
          ct.frequency_days,
          ct.completion_window_days,
          ct.location,
          ct.next_due_at,
          coalesce(vco.is_overdue, false) as is_overdue,
          ct.created_at,
          ct.updated_at
        from cleaning_tasks ct
        left join v_cleaning_overview vco on vco.cleaning_task_id = ct.id
        where ct.household_id = $1
        order by
          coalesce(vco.is_overdue, false) desc,
          ct.next_due_at asc,
          ct.name asc
      `,
      [householdId]
    );

    return result.rows.map((row) => this.mapTask(row));
  }

  async createTask(
    householdId: string,
    dto: CreateCleaningTaskDto
  ): Promise<CleaningTaskRecord> {
    const result = await this.database.query<CleaningTaskRow>(
      `
        insert into cleaning_tasks (
          household_id,
          name,
          frequency_mode,
          frequency_days,
          completion_window_days,
          location,
          next_due_at
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning
          id,
          household_id,
          name,
          frequency_mode,
          frequency_days,
          completion_window_days,
          location,
          next_due_at,
          (next_due_at < current_date) as is_overdue,
          created_at,
          updated_at
      `,
      [
        householdId,
        this.normalizeName(dto.name),
        dto.frequencyMode,
        dto.frequencyDays,
        dto.completionWindowDays ?? 0,
        dto.location ?? null,
        dto.nextDueAt
      ]
    );

    const task = this.mapTaskOrThrow(result.rows[0]);
    this.realtime.publish(householdId, 'cleaning.changed', task.id);

    return task;
  }

  async updateTask(
    householdId: string,
    taskId: string,
    dto: UpdateCleaningTaskDto
  ): Promise<CleaningTaskRecord | null> {
    if (
      dto.name === undefined &&
      dto.frequencyMode === undefined &&
      dto.frequencyDays === undefined &&
      dto.completionWindowDays === undefined &&
      dto.location === undefined &&
      dto.nextDueAt === undefined
    ) {
      throw new BadRequestException('No cleaning task fields to update');
    }

    const current = await this.findTask(householdId, taskId);

    if (!current) {
      return null;
    }

    const result = await this.database.query<CleaningTaskRow>(
      `
        update cleaning_tasks
        set
          name = $3,
          frequency_mode = $4,
          frequency_days = $5,
          completion_window_days = $6,
          location = $7,
          next_due_at = $8
        where household_id = $1
          and id = $2
        returning
          id,
          household_id,
          name,
          frequency_mode,
          frequency_days,
          completion_window_days,
          location,
          next_due_at,
          (next_due_at < current_date) as is_overdue,
          created_at,
          updated_at
      `,
      [
        householdId,
        taskId,
        dto.name === undefined ? current.name : this.normalizeName(dto.name),
        dto.frequencyMode ?? current.frequencyMode,
        dto.frequencyDays ?? current.frequencyDays,
        dto.completionWindowDays ?? current.completionWindowDays,
        dto.location !== undefined ? dto.location : current.location,
        dto.nextDueAt ?? current.nextDueAt
      ]
    );

    const task = result.rows[0] ? this.mapTask(result.rows[0]) : null;

    if (task) {
      this.realtime.publish(householdId, 'cleaning.changed', task.id);
    }

    return task;
  }

  async deleteTask(householdId: string, taskId: string): Promise<boolean> {
    const result = await this.database.query(
      `
        delete from cleaning_tasks
        where household_id = $1
          and id = $2
      `,
      [householdId, taskId]
    );

    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, 'cleaning.changed', taskId);
    }

    return deleted;
  }

  async completeTask(
    householdId: string,
    completedByMemberId: string,
    taskId: string,
    dto: CompleteCleaningTaskDto
  ): Promise<CleaningTaskRecord | null> {
    const task = await this.database.transaction(async (client) => {
      const taskResult = await client.query<CleaningTaskRow>(
        `
          select
            id,
            household_id,
            name,
            frequency_mode,
            frequency_days,
            completion_window_days,
            location,
            next_due_at,
            (next_due_at < current_date) as is_overdue,
            created_at,
            updated_at
          from cleaning_tasks
          where household_id = $1
            and id = $2
          for update
        `,
        [householdId, taskId]
      );
      const task = taskResult.rows[0];

      if (!task) {
        return null;
      }

      const completedAt = dto.completedAt ?? (await this.getCurrentDate(client));
      await client.query(
        `
          insert into cleaning_task_history (
            cleaning_task_id,
            completed_at,
            completed_by_member_id
          )
          values ($1, $2, $3)
        `,
        [task.id, completedAt, completedByMemberId]
      );

      const updatedResult = await client.query<CleaningTaskRow>(
        `
          update cleaning_tasks
          set next_due_at = ($3::date + ($4::integer * interval '1 day'))::date
          where household_id = $1
            and id = $2
          returning
            id,
            household_id,
            name,
            frequency_mode,
            frequency_days,
            completion_window_days,
            location,
            next_due_at,
            (next_due_at < current_date) as is_overdue,
            created_at,
            updated_at
        `,
        [householdId, task.id, completedAt, task.frequency_days]
      );

      return updatedResult.rows[0] ? this.mapTask(updatedResult.rows[0]) : null;
    });

    if (task) {
      this.realtime.publish(householdId, 'cleaning.changed', task.id);
    }

    return task;
  }

  async listHistory(
    householdId: string,
    taskId: string
  ): Promise<CleaningHistoryRecord[] | null> {
    const task = await this.findTask(householdId, taskId);

    if (!task) {
      return null;
    }

    const result = await this.database.query<CleaningHistoryRow>(
      `
        select
          cth.id,
          cth.cleaning_task_id,
          cth.completed_at,
          cth.completed_by_member_id,
          u.display_name as completed_by_display_name,
          cth.created_at
        from cleaning_task_history cth
        left join household_members hm on hm.id = cth.completed_by_member_id
        left join users u on u.id = hm.user_id
        where cth.cleaning_task_id = $1
        order by cth.completed_at desc, cth.created_at desc
      `,
      [taskId]
    );

    return result.rows.map((row) => ({
      cleaningTaskId: row.cleaning_task_id,
      completedAt: this.formatDateOnly(row.completed_at),
      completedBy: row.completed_by_member_id
        ? {
            displayName: row.completed_by_display_name,
            memberId: row.completed_by_member_id
          }
        : null,
      createdAt: row.created_at,
      id: row.id
    }));
  }

  private async findTask(
    householdId: string,
    taskId: string
  ): Promise<CleaningTaskRecord | null> {
    const result = await this.database.query<CleaningTaskRow>(
      `
        select
          ct.id,
          ct.household_id,
          ct.name,
          ct.frequency_mode,
          ct.frequency_days,
          ct.completion_window_days,
          ct.location,
          ct.next_due_at,
          coalesce(vco.is_overdue, false) as is_overdue,
          ct.created_at,
          ct.updated_at
        from cleaning_tasks ct
        left join v_cleaning_overview vco on vco.cleaning_task_id = ct.id
        where ct.household_id = $1
          and ct.id = $2
        limit 1
      `,
      [householdId, taskId]
    );

    return result.rows[0] ? this.mapTask(result.rows[0]) : null;
  }

  private async getCurrentDate(client: PoolClient): Promise<string> {
    const result = await client.query<{ current_date: string }>(
      `
        select current_date::text as current_date
      `
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error('Expected current date');
    }

    return row.current_date;
  }

  private normalizeName(name: string): string {
    const normalized = name.trim();

    if (!normalized) {
      throw new BadRequestException('Cleaning task name is required');
    }

    return normalized;
  }

  private mapTaskOrThrow(row: CleaningTaskRow | undefined): CleaningTaskRecord {
    if (!row) {
      throw new Error('Expected cleaning task record');
    }

    return this.mapTask(row);
  }

  private mapTask(row: CleaningTaskRow): CleaningTaskRecord {
    return {
      completionWindowDays: row.completion_window_days,
      createdAt: row.created_at,
      frequencyDays: row.frequency_days,
      frequencyMode: row.frequency_mode,
      householdId: row.household_id,
      id: row.id,
      isOverdue: row.is_overdue,
      location: row.location ?? null,
      name: row.name,
      nextDueAt: this.formatDateOnly(row.next_due_at),
      updatedAt: row.updated_at
    };
  }

  private formatDateOnly(value: Date | string): string {
    if (typeof value === 'string') {
      return value.slice(0, 10);
    }

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}

interface CleaningTaskRow {
  completion_window_days: number;
  created_at: string;
  frequency_days: number;
  frequency_mode: CleaningFrequencyMode;
  household_id: string;
  id: string;
  is_overdue: boolean;
  location: string | null;
  name: string;
  next_due_at: Date | string;
  updated_at: string;
}

interface CleaningHistoryRow {
  cleaning_task_id: string;
  completed_at: Date | string;
  completed_by_display_name: string | null;
  completed_by_member_id: string | null;
  created_at: string;
  id: string;
}

export interface CleaningTaskRecord {
  completionWindowDays: number;
  createdAt: string;
  frequencyDays: number;
  frequencyMode: CleaningFrequencyMode;
  householdId: string;
  id: string;
  isOverdue: boolean;
  location: string | null;
  name: string;
  nextDueAt: string;
  updatedAt: string;
}

export interface CleaningHistoryRecord {
  cleaningTaskId: string;
  completedAt: string;
  completedBy: {
    displayName: string | null;
    memberId: string;
  } | null;
  createdAt: string;
  id: string;
}

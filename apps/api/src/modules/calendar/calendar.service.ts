import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CalendarScopeType,
  CreateCalendarEventDto,
  UpdateCalendarEventDto
} from './dto/calendar.dto';

@Injectable()
export class CalendarService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async listEvents(
    householdId: string,
    from: string,
    to: string
  ): Promise<CalendarEventRecord[]> {
    this.ensureDateRange(from, to);

    return this.listExpandedEvents(householdId, from, to);
  }

  async listUpcoming(householdId: string, limit: number): Promise<CalendarEventRecord[]> {
    const today = await this.getCurrentDate();
    const windowEnd = this.addDays(today, 365);
    const events = await this.listExpandedEvents(householdId, today, windowEnd);

    return events.slice(0, limit);
  }

  async createEvent(
    householdId: string,
    dto: CreateCalendarEventDto
  ): Promise<CalendarEventRecord> {
    const scope = await this.resolveScope(householdId, dto.scopeType, dto.ownerMemberId);
    const result = await this.database.query<CalendarEventRow>(
      `
        insert into calendar_events (
          household_id,
          scope_type,
          owner_member_id,
          title,
          event_date,
          event_time,
          note,
          recurrence_rule
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning id, household_id, scope_type, owner_member_id, title, event_date, event_time,
          note, recurrence_rule, created_at, updated_at
      `,
      [
        householdId,
        scope.scopeType,
        scope.ownerMemberId,
        this.normalizeTitle(dto.title),
        dto.eventDate,
        this.normalizeNullableText(dto.eventTime),
        this.normalizeNullableText(dto.note),
        this.normalizeRecurrenceRule(dto.recurrenceRule)
      ]
    );

    const event = this.mapEvent(result.rows[0]);
    this.realtime.publish(householdId, 'calendar.changed', event.id);

    return event;
  }

  async updateEvent(
    householdId: string,
    eventId: string,
    dto: UpdateCalendarEventDto
  ): Promise<CalendarEventRecord | null> {
    if (
      dto.title === undefined &&
      dto.eventDate === undefined &&
      dto.eventTime === undefined &&
      dto.note === undefined &&
      dto.recurrenceRule === undefined &&
      dto.scopeType === undefined &&
      dto.ownerMemberId === undefined
    ) {
      throw new BadRequestException('No calendar event fields to update');
    }

    const current = await this.findEvent(householdId, eventId);

    if (!current) {
      return null;
    }

    const scope = await this.resolveScope(
      householdId,
      dto.scopeType ?? current.scopeType,
      dto.ownerMemberId === undefined ? current.ownerMemberId : dto.ownerMemberId
    );

    const result = await this.database.query<CalendarEventRow>(
      `
        update calendar_events
        set
          scope_type = $3,
          owner_member_id = $4,
          title = $5,
          event_date = $6,
          event_time = $7,
          note = $8,
          recurrence_rule = $9
        where household_id = $1
          and id = $2
        returning id, household_id, scope_type, owner_member_id, title, event_date, event_time,
          note, recurrence_rule, created_at, updated_at
      `,
      [
        householdId,
        eventId,
        scope.scopeType,
        scope.ownerMemberId,
        dto.title === undefined ? current.title : this.normalizeTitle(dto.title),
        dto.eventDate ?? current.eventDate,
        dto.eventTime === undefined ? current.eventTime : this.normalizeNullableText(dto.eventTime),
        dto.note === undefined ? current.note : this.normalizeNullableText(dto.note),
        dto.recurrenceRule === undefined
          ? current.recurrenceRule
          : this.normalizeRecurrenceRule(dto.recurrenceRule)
      ]
    );

    const row = result.rows[0];

    const event = row ? this.mapEvent(row) : null;

    if (event) {
      this.realtime.publish(householdId, 'calendar.changed', event.id);
    }

    return event;
  }

  async deleteEvent(householdId: string, eventId: string): Promise<boolean> {
    const result = await this.database.query(
      `
        delete from calendar_events
        where household_id = $1
          and id = $2
      `,
      [householdId, eventId]
    );

    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, 'calendar.changed', eventId);
    }

    return deleted;
  }

  private async findEvent(
    householdId: string,
    eventId: string
  ): Promise<CalendarEventRecord | null> {
    const result = await this.database.query<CalendarEventRow>(
      `
        select id, household_id, scope_type, owner_member_id, title, event_date, event_time,
          note, recurrence_rule, created_at, updated_at
        from calendar_events
        where household_id = $1
          and id = $2
      `,
      [householdId, eventId]
    );

    const row = result.rows[0];

    return row ? this.mapEvent(row) : null;
  }

  private async listExpandedEvents(
    householdId: string,
    from: string,
    to: string
  ): Promise<CalendarEventRecord[]> {
    const result = await this.database.query<CalendarEventRow>(
      `
        select id, household_id, scope_type, owner_member_id, title, event_date, event_time,
          note, recurrence_rule, created_at, updated_at
        from calendar_events
        where household_id = $1
          and event_date <= $3
          and (event_date >= $2 or recurrence_rule is not null)
        order by event_date asc, event_time asc nulls first, created_at asc
      `,
      [householdId, from, to]
    );
    const expanded = result.rows.flatMap((row) => this.expandEvent(row, from, to));

    return expanded.sort((left, right) => this.compareEvents(left, right));
  }

  private expandEvent(
    row: CalendarEventRow,
    from: string,
    to: string
  ): CalendarEventRecord[] {
    const event = this.mapEvent(row);

    if (!event.recurrenceRule) {
      return event.eventDate >= from && event.eventDate <= to ? [event] : [];
    }

    const recurrence = this.parseRecurrenceRule(event.recurrenceRule);
    const occurrences: CalendarEventRecord[] = [];
    let occurrenceDate = event.eventDate;
    let occurrenceIndex = 0;
    const maxOccurrences = recurrence.count ?? 500;

    while (occurrenceDate <= to && occurrenceIndex < maxOccurrences) {
      occurrenceIndex += 1;

      if (recurrence.until && occurrenceDate > recurrence.until) {
        break;
      }

      if (occurrenceDate >= from) {
        occurrences.push({
          ...event,
          eventDate: occurrenceDate,
          id: occurrenceDate === event.eventDate ? event.id : `${event.id}:${occurrenceDate}`,
          sourceEventId: event.id
        });
      }

      occurrenceDate = this.nextOccurrenceDate(occurrenceDate, recurrence);
    }

    return occurrences;
  }

  private compareEvents(left: CalendarEventRecord, right: CalendarEventRecord): number {
    return (
      left.eventDate.localeCompare(right.eventDate) ||
      (left.eventTime ?? '').localeCompare(right.eventTime ?? '') ||
      left.createdAt.localeCompare(right.createdAt)
    );
  }

  private async resolveScope(
    householdId: string,
    scopeType: CalendarScopeType,
    ownerMemberId: string | null | undefined
  ): Promise<{ ownerMemberId: string | null; scopeType: CalendarScopeType }> {
    if (scopeType === 'household') {
      if (ownerMemberId) {
        throw new BadRequestException('ownerMemberId must be empty for household calendar events');
      }

      return { ownerMemberId: null, scopeType };
    }

    if (!ownerMemberId) {
      throw new BadRequestException('ownerMemberId is required for member calendar events');
    }

    await this.ensureActiveMember(householdId, ownerMemberId);

    return { ownerMemberId, scopeType };
  }

  private async ensureActiveMember(householdId: string, memberId: string): Promise<void> {
    const result = await this.database.query<{ id: string }>(
      `
        select id
        from household_members
        where household_id = $1
          and id = $2
          and is_active = true
        limit 1
      `,
      [householdId, memberId]
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Owner member must be an active household member');
    }
  }

  private ensureDateRange(from: string, to: string): void {
    if (from > to) {
      throw new BadRequestException('from must be before or equal to to');
    }
  }

  private normalizeTitle(title: string): string {
    const normalized = title.trim();

    if (!normalized) {
      throw new BadRequestException('Calendar event title is required');
    }

    return normalized;
  }

  private normalizeNullableText(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    return value.trim();
  }

  private normalizeRecurrenceRule(value: string | null | undefined): string | null {
    const normalized = this.normalizeNullableText(value);

    if (!normalized) {
      return null;
    }

    const recurrence = this.parseRecurrenceRule(normalized);
    const parts = [`FREQ=${recurrence.frequency}`];

    if (recurrence.interval !== 1) {
      parts.push(`INTERVAL=${recurrence.interval}`);
    }

    if (recurrence.until) {
      parts.push(`UNTIL=${recurrence.until}`);
    }

    if (recurrence.count) {
      parts.push(`COUNT=${recurrence.count}`);
    }

    return parts.join(';');
  }

  private parseRecurrenceRule(rule: string): RecurrenceRule {
    const values = new Map<string, string>();

    for (const part of rule.split(';')) {
      const [rawKey, rawValue] = part.split('=');
      const key = rawKey?.trim().toUpperCase();
      const value = rawValue?.trim().toUpperCase();

      if (!key || !value || values.has(key)) {
        throw new BadRequestException('Invalid recurrence rule');
      }

      values.set(key, value);
    }

    const frequency = values.get('FREQ');

    if (!isRecurrenceFrequency(frequency)) {
      throw new BadRequestException('Recurrence rule requires FREQ=DAILY, WEEKLY or MONTHLY');
    }

    const interval = this.parsePositiveInteger(values.get('INTERVAL') ?? '1', 'INTERVAL');
    const until = values.get('UNTIL');
    const count = values.get('COUNT')
      ? this.parsePositiveInteger(this.required(values.get('COUNT')), 'COUNT')
      : undefined;

    if (interval > 365) {
      throw new BadRequestException('Recurrence INTERVAL is too large');
    }

    if (count !== undefined && count > 500) {
      throw new BadRequestException('Recurrence COUNT is too large');
    }

    if (until && !this.isDateOnly(until)) {
      throw new BadRequestException('Recurrence UNTIL must be YYYY-MM-DD');
    }

    return {
      count,
      frequency,
      interval,
      until
    };
  }

  private parsePositiveInteger(value: string, label: string): number {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(`Recurrence ${label} must be a positive integer`);
    }

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new BadRequestException(`Recurrence ${label} must be a positive integer`);
    }

    return parsed;
  }

  private nextOccurrenceDate(date: string, recurrence: RecurrenceRule): string {
    switch (recurrence.frequency) {
      case 'DAILY':
        return this.addDays(date, recurrence.interval);
      case 'WEEKLY':
        return this.addDays(date, recurrence.interval * 7);
      case 'MONTHLY':
        return this.addMonths(date, recurrence.interval);
    }
  }

  private async getCurrentDate(): Promise<string> {
    const result = await this.database.query<{ today: string }>(
      `
        select current_date::text as today
      `
    );

    return this.required(result.rows[0]?.today);
  }

  private addDays(date: string, days: number): string {
    const parsed = this.parseDateOnly(date);
    parsed.setUTCDate(parsed.getUTCDate() + days);

    return parsed.toISOString().slice(0, 10);
  }

  private addMonths(date: string, months: number): string {
    const parsed = this.parseDateOnly(date);
    const originalDay = parsed.getUTCDate();
    parsed.setUTCDate(1);
    parsed.setUTCMonth(parsed.getUTCMonth() + months);
    const lastDay = new Date(
      Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0)
    ).getUTCDate();
    parsed.setUTCDate(Math.min(originalDay, lastDay));

    return parsed.toISOString().slice(0, 10);
  }

  private parseDateOnly(value: string): Date {
    if (!this.isDateOnly(value)) {
      throw new BadRequestException('Invalid date');
    }

    return new Date(`${value}T00:00:00.000Z`);
  }

  private isDateOnly(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  private required<T>(value: T | null | undefined): T {
    if (value === null || value === undefined) {
      throw new BadRequestException('Invalid recurrence rule');
    }

    return value;
  }

  private mapEvent(row: CalendarEventRow | undefined): CalendarEventRecord {
    if (!row) {
      throw new Error('Expected calendar event record');
    }

    return {
      createdAt: row.created_at,
      eventDate: this.formatDateOnly(row.event_date),
      eventTime: row.event_time,
      householdId: row.household_id,
      id: row.id,
      note: row.note,
      ownerMemberId: row.owner_member_id,
      recurrenceRule: row.recurrence_rule,
      scopeType: row.scope_type,
      title: row.title,
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

interface CalendarEventRow {
  created_at: string;
  event_date: Date | string;
  event_time: string | null;
  household_id: string;
  id: string;
  note: string | null;
  owner_member_id: string | null;
  recurrence_rule: string | null;
  scope_type: CalendarScopeType;
  title: string;
  updated_at: string;
}

export interface CalendarEventRecord {
  createdAt: string;
  eventDate: string;
  eventTime: string | null;
  householdId: string;
  id: string;
  note: string | null;
  ownerMemberId: string | null;
  recurrenceRule: string | null;
  scopeType: CalendarScopeType;
  sourceEventId?: string;
  title: string;
  updatedAt: string;
}

type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

interface RecurrenceRule {
  count?: number;
  frequency: RecurrenceFrequency;
  interval: number;
  until?: string;
}

function isRecurrenceFrequency(value: string | undefined): value is RecurrenceFrequency {
  return value === 'DAILY' || value === 'WEEKLY' || value === 'MONTHLY';
}

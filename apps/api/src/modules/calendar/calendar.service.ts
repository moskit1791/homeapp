import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeService } from "../realtime/realtime.service";
import {
  CalendarScopeType,
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
} from "./dto/calendar.dto";

@Injectable()
export class CalendarService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CalendarService.name);
  private reminderTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly database: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  onModuleInit(): void {
    this.reminderTimer = setInterval(() => {
      this.dispatchDueReminders().catch((error) => {
        this.logger.warn("Failed to dispatch calendar reminders", error);
      });
    }, 60_000);
    this.reminderTimer.unref?.();

    this.dispatchDueReminders().catch((error) => {
      this.logger.warn("Failed to dispatch calendar reminders", error);
    });
  }

  onModuleDestroy(): void {
    if (this.reminderTimer) {
      clearInterval(this.reminderTimer);
      this.reminderTimer = null;
    }
  }

  async listEvents(
    householdId: string,
    from: string,
    to: string,
  ): Promise<CalendarEventRecord[]> {
    this.ensureDateRange(from, to);

    return this.listExpandedEvents(householdId, from, to);
  }

  async listUpcoming(
    householdId: string,
    limit: number,
  ): Promise<CalendarEventRecord[]> {
    const now = await this.getCurrentDateTime();
    const windowEnd = this.addDays(now.date, 365);
    const events = await this.listExpandedEvents(
      householdId,
      now.date,
      windowEnd,
    );

    return events
      .filter((event) => this.isUpcomingEvent(event, now))
      .slice(0, limit);
  }

  async createEvent(
    householdId: string,
    dto: CreateCalendarEventDto,
  ): Promise<CalendarEventRecord> {
    const scope = await this.resolveScope(
      householdId,
      dto.scopeType,
      dto.ownerMemberId,
    );
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
          location_name,
          location_url,
          recurrence_rule,
          reminder_offset_minutes
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        returning id, household_id, scope_type, owner_member_id, title, event_date, event_time,
          note, location_name, location_url, recurrence_rule, reminder_offset_minutes,
          reminder_sent_at, created_at, updated_at
      `,
      [
        householdId,
        scope.scopeType,
        scope.ownerMemberId,
        this.normalizeTitle(dto.title),
        dto.eventDate,
        this.normalizeNullableText(dto.eventTime),
        this.normalizeNullableText(dto.note),
        this.normalizeNullableText(dto.locationName),
        this.normalizeNullableText(dto.locationUrl),
        this.normalizeRecurrenceRule(dto.recurrenceRule),
        dto.reminderOffsetMinutes === undefined
          ? 1440
          : this.normalizeReminderOffset(dto.reminderOffsetMinutes),
      ],
    );

    const event = this.mapEvent(result.rows[0]);
    this.realtime.publish(householdId, "calendar.changed", event.id);

    return event;
  }

  async updateEvent(
    householdId: string,
    eventId: string,
    dto: UpdateCalendarEventDto,
  ): Promise<CalendarEventRecord | null> {
    if (
      dto.title === undefined &&
      dto.eventDate === undefined &&
      dto.eventTime === undefined &&
      dto.note === undefined &&
      dto.locationName === undefined &&
      dto.locationUrl === undefined &&
      dto.recurrenceRule === undefined &&
      dto.reminderOffsetMinutes === undefined &&
      dto.scopeType === undefined &&
      dto.ownerMemberId === undefined
    ) {
      throw new BadRequestException("No calendar event fields to update");
    }

    const current = await this.findEvent(householdId, eventId);

    if (!current) {
      return null;
    }

    const scope = await this.resolveScope(
      householdId,
      dto.scopeType ?? current.scopeType,
      dto.ownerMemberId === undefined
        ? current.ownerMemberId
        : dto.ownerMemberId,
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
          location_name = $9,
          location_url = $10,
          recurrence_rule = $11,
          reminder_offset_minutes = $12,
          reminder_sent_at = case
            when $6 <> event_date
              or $7 is distinct from event_time
              or $12 is distinct from reminder_offset_minutes
            then null
            else reminder_sent_at
          end
        where household_id = $1
          and id = $2
        returning id, household_id, scope_type, owner_member_id, title, event_date, event_time,
          note, location_name, location_url, recurrence_rule, reminder_offset_minutes,
          reminder_sent_at, created_at, updated_at
      `,
      [
        householdId,
        eventId,
        scope.scopeType,
        scope.ownerMemberId,
        dto.title === undefined
          ? current.title
          : this.normalizeTitle(dto.title),
        dto.eventDate ?? current.eventDate,
        dto.eventTime === undefined
          ? current.eventTime
          : this.normalizeNullableText(dto.eventTime),
        dto.note === undefined
          ? current.note
          : this.normalizeNullableText(dto.note),
        dto.locationName === undefined
          ? current.locationName
          : this.normalizeNullableText(dto.locationName),
        dto.locationUrl === undefined
          ? current.locationUrl
          : this.normalizeNullableText(dto.locationUrl),
        dto.recurrenceRule === undefined
          ? current.recurrenceRule
          : this.normalizeRecurrenceRule(dto.recurrenceRule),
        dto.reminderOffsetMinutes === undefined
          ? current.reminderOffsetMinutes
          : this.normalizeReminderOffset(dto.reminderOffsetMinutes),
      ],
    );

    const row = result.rows[0];

    const event = row ? this.mapEvent(row) : null;

    if (event) {
      this.realtime.publish(householdId, "calendar.changed", event.id);
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
      [householdId, eventId],
    );

    const deleted = Boolean(result.rowCount && result.rowCount > 0);

    if (deleted) {
      this.realtime.publish(householdId, "calendar.changed", eventId);
    }

    return deleted;
  }

  private async findEvent(
    householdId: string,
    eventId: string,
  ): Promise<CalendarEventRecord | null> {
    const result = await this.database.query<CalendarEventRow>(
      `
        select
          ce.id,
          ce.household_id,
          ce.scope_type,
          ce.owner_member_id,
          ce.title,
          ce.event_date,
          ce.event_time,
          ce.note,
          ce.location_name,
          ce.location_url,
          ce.recurrence_rule,
          ce.reminder_offset_minutes,
          ce.reminder_sent_at,
          ce.created_at,
          ce.updated_at,
          cgem.connection_id as google_connection_id,
          cgc.google_account_email as google_account_email,
          cgc.household_member_id as google_owner_member_id
        from calendar_events ce
        left join calendar_google_event_mappings cgem
          on cgem.calendar_event_id = ce.id
        left join calendar_google_connections cgc
          on cgc.id = cgem.connection_id
        where ce.household_id = $1
          and ce.id = $2
      `,
      [householdId, eventId],
    );

    const row = result.rows[0];

    return row ? this.mapEvent(row) : null;
  }

  private async listExpandedEvents(
    householdId: string,
    from: string,
    to: string,
  ): Promise<CalendarEventRecord[]> {
    const result = await this.database.query<CalendarEventRow>(
      `
        select
          ce.id,
          ce.household_id,
          ce.scope_type,
          ce.owner_member_id,
          ce.title,
          ce.event_date,
          ce.event_time,
          ce.note,
          ce.location_name,
          ce.location_url,
          ce.recurrence_rule,
          ce.reminder_offset_minutes,
          ce.reminder_sent_at,
          ce.created_at,
          ce.updated_at,
          cgem.connection_id as google_connection_id,
          cgc.google_account_email as google_account_email,
          cgc.household_member_id as google_owner_member_id
        from calendar_events ce
        left join calendar_google_event_mappings cgem
          on cgem.calendar_event_id = ce.id
        left join calendar_google_connections cgc
          on cgc.id = cgem.connection_id
        where ce.household_id = $1
          and ce.event_date <= $3
          and (ce.event_date >= $2 or ce.recurrence_rule is not null)
        order by ce.event_date asc, ce.event_time asc nulls first, ce.created_at asc
      `,
      [householdId, from, to],
    );
    const expanded = result.rows.flatMap((row) =>
      this.expandEvent(row, from, to),
    );

    return expanded.sort((left, right) => this.compareEvents(left, right));
  }

  private expandEvent(
    row: CalendarEventRow,
    from: string,
    to: string,
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
          id:
            occurrenceDate === event.eventDate
              ? event.id
              : `${event.id}:${occurrenceDate}`,
          sourceEventId: event.id,
        });
      }

      occurrenceDate = this.nextOccurrenceDate(occurrenceDate, recurrence);
    }

    return occurrences;
  }

  private compareEvents(
    left: CalendarEventRecord,
    right: CalendarEventRecord,
  ): number {
    return (
      left.eventDate.localeCompare(right.eventDate) ||
      (left.eventTime ?? "").localeCompare(right.eventTime ?? "") ||
      left.createdAt.localeCompare(right.createdAt)
    );
  }

  private isUpcomingEvent(
    event: CalendarEventRecord,
    now: { date: string; time: string },
  ): boolean {
    if (event.eventDate > now.date) {
      return true;
    }

    if (event.eventDate < now.date) {
      return false;
    }

    return !event.eventTime || event.eventTime.slice(0, 5) >= now.time;
  }

  private async resolveScope(
    householdId: string,
    scopeType: CalendarScopeType,
    ownerMemberId: string | null | undefined,
  ): Promise<{ ownerMemberId: string | null; scopeType: CalendarScopeType }> {
    if (scopeType === "household") {
      if (ownerMemberId) {
        throw new BadRequestException(
          "ownerMemberId must be empty for household calendar events",
        );
      }

      return { ownerMemberId: null, scopeType };
    }

    if (!ownerMemberId) {
      throw new BadRequestException(
        "ownerMemberId is required for member calendar events",
      );
    }

    await this.ensureActiveMember(householdId, ownerMemberId);

    return { ownerMemberId, scopeType };
  }

  private async ensureActiveMember(
    householdId: string,
    memberId: string,
  ): Promise<void> {
    const result = await this.database.query<{ id: string }>(
      `
        select id
        from household_members
        where household_id = $1
          and id = $2
          and is_active = true
        limit 1
      `,
      [householdId, memberId],
    );

    if (!result.rows[0]) {
      throw new BadRequestException(
        "Owner member must be an active household member",
      );
    }
  }

  private ensureDateRange(from: string, to: string): void {
    if (from > to) {
      throw new BadRequestException("from must be before or equal to to");
    }
  }

  private normalizeTitle(title: string): string {
    const normalized = title.trim();

    if (!normalized) {
      throw new BadRequestException("Calendar event title is required");
    }

    return normalized;
  }

  private normalizeNullableText(
    value: string | null | undefined,
  ): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    return value.trim();
  }

  private normalizeRecurrenceRule(
    value: string | null | undefined,
  ): string | null {
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

    return parts.join(";");
  }

  private normalizeReminderOffset(
    value: number | null | undefined,
  ): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (![15, 30, 60, 1440].includes(value)) {
      throw new BadRequestException("Invalid reminder offset");
    }

    return value;
  }

  private async dispatchDueReminders(): Promise<void> {
    const dueEvents = await this.database.transaction(async (client) => {
      const result = await client.query<CalendarEventRow>(
        `
          with due as (
            select id
            from calendar_events
            where reminder_offset_minutes is not null
              and reminder_sent_at is null
              and (
                event_date::timestamp + coalesce(event_time, time '09:00')
              ) >= timezone('Europe/Warsaw', now()) - interval '2 hours'
              and (
                event_date::timestamp + coalesce(event_time, time '09:00')
                  - (reminder_offset_minutes * interval '1 minute')
              ) <= timezone('Europe/Warsaw', now())
            order by event_date asc, event_time asc nulls first, created_at asc
            limit 50
            for update skip locked
          )
          update calendar_events ce
          set reminder_sent_at = now()
          from due
          where ce.id = due.id
          returning
            ce.id,
            ce.household_id,
            ce.scope_type,
            ce.owner_member_id,
            ce.title,
            ce.event_date,
            ce.event_time,
            ce.note,
            ce.location_name,
            ce.location_url,
            ce.recurrence_rule,
            ce.reminder_offset_minutes,
            ce.reminder_sent_at,
            ce.created_at,
            ce.updated_at
        `,
      );

      return result.rows.map((row) => this.mapEvent(row));
    });

    await Promise.all(
      dueEvents.map((event) =>
        this.notifications.sendCalendarEventReminder({
          eventDate: event.eventDate,
          eventTime: event.eventTime,
          householdId: event.householdId,
          reminderOffsetMinutes: event.reminderOffsetMinutes,
          title: event.title,
        }),
      ),
    );
  }

  private parseRecurrenceRule(rule: string): RecurrenceRule {
    const values = new Map<string, string>();

    for (const part of rule.split(";")) {
      const [rawKey, rawValue] = part.split("=");
      const key = rawKey?.trim().toUpperCase();
      const value = rawValue?.trim().toUpperCase();

      if (!key || !value || values.has(key)) {
        throw new BadRequestException("Invalid recurrence rule");
      }

      values.set(key, value);
    }

    const frequency = values.get("FREQ");

    if (!isRecurrenceFrequency(frequency)) {
      throw new BadRequestException(
        "Recurrence rule requires FREQ=DAILY, WEEKLY or MONTHLY",
      );
    }

    const interval = this.parsePositiveInteger(
      values.get("INTERVAL") ?? "1",
      "INTERVAL",
    );
    const until = values.get("UNTIL");
    const count = values.get("COUNT")
      ? this.parsePositiveInteger(this.required(values.get("COUNT")), "COUNT")
      : undefined;

    if (interval > 365) {
      throw new BadRequestException("Recurrence INTERVAL is too large");
    }

    if (count !== undefined && count > 500) {
      throw new BadRequestException("Recurrence COUNT is too large");
    }

    if (until && !this.isDateOnly(until)) {
      throw new BadRequestException("Recurrence UNTIL must be YYYY-MM-DD");
    }

    return {
      count,
      frequency,
      interval,
      until,
    };
  }

  private parsePositiveInteger(value: string, label: string): number {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(
        `Recurrence ${label} must be a positive integer`,
      );
    }

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new BadRequestException(
        `Recurrence ${label} must be a positive integer`,
      );
    }

    return parsed;
  }

  private nextOccurrenceDate(date: string, recurrence: RecurrenceRule): string {
    switch (recurrence.frequency) {
      case "DAILY":
        return this.addDays(date, recurrence.interval);
      case "WEEKLY":
        return this.addDays(date, recurrence.interval * 7);
      case "MONTHLY":
        return this.addMonths(date, recurrence.interval);
    }
  }

  private async getCurrentDateTime(): Promise<{ date: string; time: string }> {
    const result = await this.database.query<{
      current_time: string;
      today: string;
    }>(
      `
        select
          to_char(timezone('Europe/Warsaw', now()), 'YYYY-MM-DD') as today,
          to_char(timezone('Europe/Warsaw', now()), 'HH24:MI') as current_time
      `,
    );
    const row = result.rows[0];

    return {
      date: this.required(row?.today),
      time: this.required(row?.current_time),
    };
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
      Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0),
    ).getUTCDate();
    parsed.setUTCDate(Math.min(originalDay, lastDay));

    return parsed.toISOString().slice(0, 10);
  }

  private parseDateOnly(value: string): Date {
    if (!this.isDateOnly(value)) {
      throw new BadRequestException("Invalid date");
    }

    return new Date(`${value}T00:00:00.000Z`);
  }

  private isDateOnly(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }

  private required<T>(value: T | null | undefined): T {
    if (value === null || value === undefined) {
      throw new BadRequestException("Invalid recurrence rule");
    }

    return value;
  }

  private mapEvent(row: CalendarEventRow | undefined): CalendarEventRecord {
    if (!row) {
      throw new Error("Expected calendar event record");
    }

    return {
      createdAt: this.formatTimestamp(row.created_at),
      eventDate: this.formatDateOnly(row.event_date),
      eventTime: row.event_time,
      googleCalendarAccountEmail: row.google_account_email ?? null,
      googleCalendarConnectionId: row.google_connection_id ?? null,
      googleCalendarOwnerMemberId: row.google_owner_member_id ?? null,
      householdId: row.household_id,
      id: row.id,
      locationName: row.location_name,
      locationUrl: row.location_url,
      note: row.note,
      ownerMemberId: row.owner_member_id,
      recurrenceRule: row.recurrence_rule,
      reminderOffsetMinutes: row.reminder_offset_minutes,
      reminderSentAt: row.reminder_sent_at
        ? this.formatTimestamp(row.reminder_sent_at)
        : null,
      scopeType: row.scope_type,
      sourceType: row.google_connection_id ? "google" : "manual",
      title: row.title,
      updatedAt: this.formatTimestamp(row.updated_at),
    };
  }

  private formatDateOnly(value: Date | string): string {
    if (typeof value === "string") {
      return value.slice(0, 10);
    }

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  private formatTimestamp(value: Date | string): string {
    if (typeof value === "string") {
      return value;
    }

    return value.toISOString();
  }
}

interface CalendarEventRow {
  created_at: Date | string;
  event_date: Date | string;
  event_time: string | null;
  google_account_email?: string | null;
  google_connection_id?: string | null;
  google_owner_member_id?: string | null;
  household_id: string;
  id: string;
  location_name: string | null;
  location_url: string | null;
  note: string | null;
  owner_member_id: string | null;
  recurrence_rule: string | null;
  reminder_offset_minutes: number | null;
  reminder_sent_at: Date | string | null;
  scope_type: CalendarScopeType;
  title: string;
  updated_at: Date | string;
}

export interface CalendarEventRecord {
  createdAt: string;
  eventDate: string;
  eventTime: string | null;
  googleCalendarAccountEmail: string | null;
  googleCalendarConnectionId: string | null;
  googleCalendarOwnerMemberId: string | null;
  householdId: string;
  id: string;
  locationName: string | null;
  locationUrl: string | null;
  note: string | null;
  ownerMemberId: string | null;
  recurrenceRule: string | null;
  reminderOffsetMinutes: number | null;
  reminderSentAt: string | null;
  scopeType: CalendarScopeType;
  sourceEventId?: string;
  sourceType: "google" | "manual";
  title: string;
  updatedAt: string;
}

type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

interface RecurrenceRule {
  count?: number;
  frequency: RecurrenceFrequency;
  interval: number;
  until?: string;
}

function isRecurrenceFrequency(
  value: string | undefined,
): value is RecurrenceFrequency {
  return value === "DAILY" || value === "WEEKLY" || value === "MONTHLY";
}

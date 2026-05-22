import { describe, expect, it, vi } from 'vitest';
import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  it('sorts same-day all-day events when database timestamps are Date objects', async () => {
    const createdAt = new Date('2026-05-22T10:00:00.000Z');
    const laterCreatedAt = new Date('2026-05-22T10:05:00.000Z');
    const database = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ today: '2026-05-22' }] })
        .mockResolvedValueOnce({
          rows: [
            calendarEventRow({
              created_at: laterCreatedAt,
              id: 'event-later',
              title: 'Koniec biletow do kina'
            }),
            calendarEventRow({
              created_at: createdAt,
              id: 'event-first',
              title: 'Spisac gaz'
            })
          ]
        })
    };
    const service = new CalendarService(
      database as never,
      { sendCalendarEventReminder: vi.fn() } as never,
      { publish: vi.fn() } as never
    );

    const events = await service.listUpcoming('household-id', 5);

    expect(events.map((event) => event.id)).toEqual(['event-first', 'event-later']);
    expect(events[0]?.createdAt).toBe(createdAt.toISOString());
  });
});

function calendarEventRow(overrides: Partial<CalendarEventRowFixture> = {}): CalendarEventRowFixture {
  return {
    created_at: new Date('2026-05-22T10:00:00.000Z'),
    event_date: '2026-06-30',
    event_time: null,
    household_id: 'household-id',
    id: 'event-id',
    note: null,
    owner_member_id: null,
    recurrence_rule: null,
    reminder_offset_minutes: 1440,
    reminder_sent_at: null,
    scope_type: 'household',
    title: 'Event',
    updated_at: new Date('2026-05-22T10:00:00.000Z'),
    ...overrides
  };
}

interface CalendarEventRowFixture {
  created_at: Date | string;
  event_date: Date | string;
  event_time: string | null;
  household_id: string;
  id: string;
  note: string | null;
  owner_member_id: string | null;
  recurrence_rule: string | null;
  reminder_offset_minutes: number | null;
  reminder_sent_at: Date | string | null;
  scope_type: 'household' | 'member';
  title: string;
  updated_at: Date | string;
}

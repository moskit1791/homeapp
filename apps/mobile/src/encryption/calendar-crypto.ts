import type {
  CalendarEvent,
  CreateCalendarEventRequest,
  StartCalendarEvent,
  UpdateCalendarEventRequest
} from '../api';

const encryptedTitle = '[Zaszyfrowane wydarzenie]';
const calendarEntity = 'calendar-event';

interface CalendarPrivateFields {
  locationName: string | null;
  locationUrl: string | null;
  note: string | null;
  title: string;
}

type CalendarEncryptedRecord = {
  encryptedPayload: string | null;
  locationName: string | null;
  locationUrl: string | null;
  title: string;
};

export function decryptCalendarRecord<T extends CalendarEncryptedRecord & { note?: string | null }>(
  event: T,
  decryptPayload: <P>(module: 'calendar', entity: string, payload: string) => P
): T {
  if (!event.encryptedPayload) {
    return event;
  }

  try {
    const privateFields = decryptPayload<CalendarPrivateFields>(
      'calendar',
      calendarEntity,
      event.encryptedPayload
    );

    return { ...event, ...privateFields };
  } catch {
    return {
      ...event,
      locationName: null,
      locationUrl: null,
      note: null,
      title: 'Nie można odszyfrować wydarzenia'
    };
  }
}

export function decryptCalendarEvents(
  events: CalendarEvent[],
  decryptPayload: <P>(module: 'calendar', entity: string, payload: string) => P
): CalendarEvent[] {
  return events.map((event) => decryptCalendarRecord(event, decryptPayload));
}

export function decryptStartCalendarEvents(
  events: StartCalendarEvent[],
  decryptPayload: <P>(module: 'calendar', entity: string, payload: string) => P
): StartCalendarEvent[] {
  return events.map((event) => decryptCalendarRecord(event, decryptPayload));
}

export async function protectCalendarRequest<
  T extends CreateCalendarEventRequest | UpdateCalendarEventRequest
>(
  input: T,
  options: {
    enabled: boolean;
    encryptPayload: <P>(module: 'calendar', entity: string, payload: P) => Promise<string>;
    keyVersion: number | null | undefined;
  }
): Promise<T> {
  if (!options.enabled) {
    return input;
  }

  if (!options.keyVersion) {
    throw new Error('Brak aktywnego klucza szyfrowania domu.');
  }

  const privateFields: CalendarPrivateFields = {
    locationName: input.locationName ?? null,
    locationUrl: input.locationUrl ?? null,
    note: input.note ?? null,
    title: input.title?.trim() || encryptedTitle
  };
  const encryptedPayload = await options.encryptPayload('calendar', calendarEntity, privateFields);

  return {
    ...input,
    encryptedPayload,
    encryptionVersion: options.keyVersion,
    locationName: null,
    locationUrl: null,
    note: null,
    title: encryptedTitle
  };
}

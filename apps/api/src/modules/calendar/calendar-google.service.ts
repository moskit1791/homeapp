import {
  BadRequestException,
  Injectable,
  NotImplementedException,
  UnauthorizedException
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual
} from 'node:crypto';
import { PoolClient } from 'pg';
import { loadEnv } from '../../shared/env';
import { HouseholdContext, UserContext } from '../../shared/request-context';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';

const calendarScope = 'https://www.googleapis.com/auth/calendar.events.readonly';
const googleOAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
const googleTokenUrl = 'https://oauth2.googleapis.com/token';
const googleUserInfoUrl = 'https://www.googleapis.com/oauth2/v3/userinfo';
const warsawTimeZone = 'Europe/Warsaw';

@Injectable()
export class CalendarGoogleService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async getConnectionStatus(household: HouseholdContext, user: UserContext) {
    const connection = await this.findConnection(household, user);

    return {
      connected: Boolean(connection),
      connectedAt: connection?.connected_at ? this.formatTimestamp(connection.connected_at) : null,
      googleAccountEmail: connection?.google_account_email ?? null,
      lastSyncedAt: connection?.last_synced_at ? this.formatTimestamp(connection.last_synced_at) : null
    };
  }

  createAuthorizationUrl(household: HouseholdContext, user: UserContext) {
    const config = this.loadConfig();
    const state = this.signState({
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 10 * 60,
      householdId: household.householdId,
      memberId: household.memberId,
      userId: user.userId
    });
    const params = new URLSearchParams({
      access_type: 'offline',
      client_id: config.clientId,
      include_granted_scopes: 'true',
      login_hint: user.email,
      prompt: 'consent',
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: ['openid', 'email', calendarScope].join(' '),
      state
    });

    return { authorizationUrl: `${googleOAuthUrl}?${params.toString()}` };
  }

  async handleOAuthCallback(input: { code?: string; error?: string; state?: string }) {
    if (input.error) {
      throw new BadRequestException(`Google Calendar OAuth failed: ${input.error}`);
    }

    if (!input.code || !input.state) {
      throw new BadRequestException('Google Calendar OAuth callback is missing code or state');
    }

    const config = this.loadConfig();
    const state = this.verifyState(input.state);
    const tokenResponse = await this.exchangeAuthorizationCode(input.code, config);
    const existing = await this.findConnectionByMember(state.householdId, state.memberId, state.userId);
    const refreshToken = tokenResponse.refresh_token ?? existing?.refresh_token_ciphertext;

    if (!refreshToken) {
      throw new BadRequestException('Google Calendar did not return a refresh token');
    }

    const encryptedRefreshToken = tokenResponse.refresh_token
      ? this.encrypt(tokenResponse.refresh_token, config.encryptionKey)
      : refreshToken;
    const googleAccountEmail = await this.fetchGoogleAccountEmail(tokenResponse.access_token);

    await this.database.query(
      `
        insert into calendar_google_connections (
          household_id,
          household_member_id,
          user_id,
          google_account_email,
          google_calendar_id,
          refresh_token_ciphertext,
          scope
        )
        values ($1, $2, $3, $4, 'primary', $5, $6)
        on conflict (household_member_id) do update
        set
          google_account_email = excluded.google_account_email,
          refresh_token_ciphertext = excluded.refresh_token_ciphertext,
          scope = excluded.scope,
          connected_at = now()
      `,
      [
        state.householdId,
        state.memberId,
        state.userId,
        googleAccountEmail,
        encryptedRefreshToken,
        tokenResponse.scope || calendarScope
      ]
    );

    return { googleAccountEmail };
  }

  async sync(household: HouseholdContext, user: UserContext) {
    const config = this.loadConfig();
    const connection = await this.findConnection(household, user);

    if (!connection) {
      throw new BadRequestException('Google Calendar is not connected');
    }

    const refreshToken = this.decrypt(connection.refresh_token_ciphertext, config.encryptionKey);
    const accessToken = await this.refreshAccessToken(refreshToken, config);
    const range = this.getDefaultSyncRange();
    const googleEvents = await this.fetchGoogleEvents(accessToken, range);
    const importableEvents = googleEvents
      .filter((event) => event.status !== 'cancelled')
      .map((event) => this.mapGoogleEvent(event))
      .filter((event): event is ImportedGoogleEvent => Boolean(event));
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = googleEvents.length - importableEvents.length;

    await this.database.transaction(async (client) => {
      for (const event of importableEvents) {
        const result = await this.upsertImportedEvent(client, connection, event);

        if (result === 'inserted') {
          importedCount += 1;
        } else if (result === 'updated') {
          updatedCount += 1;
        } else {
          skippedCount += 1;
        }
      }

      await client.query(
        `
          update calendar_google_connections
          set last_synced_at = now()
          where id = $1
        `,
        [connection.id]
      );
    });

    this.realtime.publish(household.householdId, 'calendar.changed', 'google-sync');

    return {
      from: range.from,
      importedCount,
      skippedCount,
      to: range.to,
      updatedCount
    };
  }

  private async upsertImportedEvent(
    client: PoolClient,
    connection: GoogleCalendarConnectionRow,
    event: ImportedGoogleEvent
  ): Promise<'inserted' | 'skipped' | 'updated'> {
    const existing = await client.query<{ calendar_event_id: string }>(
      `
        select calendar_event_id
        from calendar_google_event_mappings
        where connection_id = $1
          and google_event_id = $2
      `,
      [connection.id, event.googleEventId]
    );
    const existingId = existing.rows[0]?.calendar_event_id;

    if (existingId) {
      await client.query(
        `
          update calendar_events
          set
            title = $3,
            event_date = $4,
            event_time = $5,
            note = $6,
            recurrence_rule = null,
            reminder_offset_minutes = null,
            reminder_sent_at = null
          where id = $1
            and household_id = $2
        `,
        [
          existingId,
          connection.household_id,
          event.title,
          event.eventDate,
          event.eventTime,
          event.note
        ]
      );
      await client.query(
        `
          update calendar_google_event_mappings
          set google_updated_at = $3
          where connection_id = $1
            and google_event_id = $2
        `,
        [connection.id, event.googleEventId, event.googleUpdatedAt]
      );

      return 'updated';
    }

    const inserted = await client.query<{ id: string }>(
      `
        insert into calendar_events (
          household_id,
          scope_type,
          owner_member_id,
          title,
          event_date,
          event_time,
          note,
          recurrence_rule,
          reminder_offset_minutes
        )
        values ($1, 'member', $2, $3, $4, $5, $6, null, null)
        returning id
      `,
      [
        connection.household_id,
        connection.household_member_id,
        event.title,
        event.eventDate,
        event.eventTime,
        event.note
      ]
    );
    const eventId = inserted.rows[0]?.id;

    if (!eventId) {
      return 'skipped';
    }

    await client.query(
      `
        insert into calendar_google_event_mappings (
          connection_id,
          google_event_id,
          calendar_event_id,
          google_updated_at
        )
        values ($1, $2, $3, $4)
        on conflict (connection_id, google_event_id) do nothing
      `,
      [connection.id, event.googleEventId, eventId, event.googleUpdatedAt]
    );

    return 'inserted';
  }

  private async findConnection(household: HouseholdContext, user: UserContext) {
    return this.findConnectionByMember(household.householdId, household.memberId, user.userId);
  }

  private async findConnectionByMember(householdId: string, memberId: string, userId: string) {
    const result = await this.database.query<GoogleCalendarConnectionRow>(
      `
        select id, household_id, household_member_id, user_id, google_account_email,
          google_calendar_id, refresh_token_ciphertext, scope, connected_at, last_synced_at
        from calendar_google_connections
        where household_id = $1
          and household_member_id = $2
          and user_id = $3
      `,
      [householdId, memberId, userId]
    );

    return result.rows[0] ?? null;
  }

  private loadConfig(): GoogleCalendarConfig {
    const env = loadEnv();

    if (
      !env.GOOGLE_CALENDAR_CLIENT_ID ||
      !env.GOOGLE_CALENDAR_CLIENT_SECRET ||
      !env.GOOGLE_CALENDAR_REDIRECT_URI ||
      !env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY
    ) {
      throw new NotImplementedException('Google Calendar sync is not configured');
    }

    return {
      clientId: env.GOOGLE_CALENDAR_CLIENT_ID,
      clientSecret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
      encryptionKey: this.normalizeEncryptionKey(env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY),
      redirectUri: env.GOOGLE_CALENDAR_REDIRECT_URI
    };
  }

  private signState(payload: GoogleCalendarOAuthState): string {
    const env = loadEnv();
    const body = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.base64UrlEncode(
      createHmac('sha256', env.JWT_ACCESS_SECRET).update(body).digest()
    );

    return `${body}.${signature}`;
  }

  private verifyState(value: string): GoogleCalendarOAuthState {
    const env = loadEnv();
    const [body, signature] = value.split('.');

    if (!body || !signature) {
      throw new BadRequestException('Invalid Google Calendar OAuth state');
    }

    const expected = this.base64UrlEncode(
      createHmac('sha256', env.JWT_ACCESS_SECRET).update(body).digest()
    );
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid Google Calendar OAuth state');
    }

    const parsed = JSON.parse(this.base64UrlDecode(body).toString('utf8')) as GoogleCalendarOAuthState;

    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Google Calendar OAuth state expired');
    }

    return parsed;
  }

  private async exchangeAuthorizationCode(code: string, config: GoogleCalendarConfig) {
    return this.postGoogleToken<GoogleTokenResponse>({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri
    });
  }

  private async refreshAccessToken(refreshToken: string, config: GoogleCalendarConfig) {
    const response = await this.postGoogleToken<GoogleTokenResponse>({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    return response.access_token;
  }

  private async postGoogleToken<T>(params: Record<string, string>): Promise<T> {
    const response = await fetch(googleTokenUrl, {
      body: new URLSearchParams(params).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST'
    });

    if (!response.ok) {
      throw new BadRequestException('Google Calendar token exchange failed');
    }

    return response.json() as Promise<T>;
  }

  private async fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
    const response = await fetch(googleUserInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      return null;
    }

    const profile = (await response.json()) as { email?: string };

    return profile.email ?? null;
  }

  private async fetchGoogleEvents(accessToken: string, range: { from: string; to: string }) {
    const events: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        maxResults: '2500',
        orderBy: 'startTime',
        singleEvents: 'true',
        timeMax: `${range.to}T23:59:59+01:00`,
        timeMin: `${range.from}T00:00:00+01:00`,
        timeZone: warsawTimeZone
      });

      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        throw new BadRequestException('Google Calendar sync request failed');
      }

      const data = (await response.json()) as GoogleCalendarEventsResponse;

      events.push(...(data.items ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    return events;
  }

  private mapGoogleEvent(event: GoogleCalendarEvent): ImportedGoogleEvent | null {
    const start = event.start?.date ?? event.start?.dateTime;

    if (!event.id || !start) {
      return null;
    }

    const hasTime = Boolean(event.start?.dateTime);
    const eventDate = start.slice(0, 10);
    const eventTime = hasTime && start.length >= 16 ? start.slice(11, 16) : null;
    const noteParts = [
      event.location ? `Miejsce: ${event.location}` : null,
      event.description ? event.description : null,
      'Źródło: Google Calendar'
    ].filter(Boolean);

    return {
      eventDate,
      eventTime,
      googleEventId: event.id,
      googleUpdatedAt: event.updated ?? null,
      note: noteParts.join('\n\n').slice(0, 4000) || null,
      title: (event.summary?.trim() || 'Wydarzenie z Google Calendar').slice(0, 240)
    };
  }

  private getDefaultSyncRange() {
    const now = new Date();
    const from = new Date(now);
    const to = new Date(now);

    from.setDate(now.getDate() - 30);
    to.setDate(now.getDate() + 365);

    return {
      from: this.formatDate(from),
      to: this.formatDate(to)
    };
  }

  private normalizeEncryptionKey(value: string): Buffer {
    const decoded = Buffer.from(value, 'base64');

    if (decoded.length === 32) {
      return decoded;
    }

    const raw = Buffer.from(value);

    if (raw.length === 32) {
      return raw;
    }

    throw new NotImplementedException('Google Calendar token encryption key is invalid');
  }

  private encrypt(value: string, key: Buffer): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv, authTag, encrypted].map((part) => this.base64UrlEncode(part)).join('.');
  }

  private decrypt(value: string, key: Buffer): string {
    const parts = value.split('.').map((part) => this.base64UrlDecode(part));
    const [iv, authTag, encrypted] = parts;

    if (!iv || !authTag || !encrypted) {
      throw new UnauthorizedException('Invalid Google Calendar OAuth state');
    }

    const decipher = createDecipheriv('aes-256-gcm', key, iv);

    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  private base64UrlEncode(value: string | Buffer): string {
    const buffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;

    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private base64UrlDecode(value: string): Buffer {
    const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');

    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
  }

  private formatTimestamp(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}

interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  encryptionKey: Buffer;
  redirectUri: string;
}

interface GoogleCalendarOAuthState {
  email: string;
  exp: number;
  householdId: string;
  memberId: string;
  userId: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

interface GoogleCalendarConnectionRow {
  connected_at: Date | string;
  google_account_email: string | null;
  google_calendar_id: string;
  household_id: string;
  household_member_id: string;
  id: string;
  last_synced_at: Date | string | null;
  refresh_token_ciphertext: string;
  scope: string;
  user_id: string;
}

interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
}

interface GoogleCalendarEvent {
  description?: string;
  id?: string;
  location?: string;
  start?: {
    date?: string;
    dateTime?: string;
  };
  status?: string;
  summary?: string;
  updated?: string;
}

interface ImportedGoogleEvent {
  eventDate: string;
  eventTime: string | null;
  googleEventId: string;
  googleUpdatedAt: string | null;
  note: string | null;
  title: string;
}

import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { REALTIME_EVENTS, RealtimeEventType } from "@homeapp/shared-types";
import webPush from "web-push";
import { HouseholdContext, UserContext } from "../../shared/request-context";
import { loadEnv } from "../../shared/env";
import { DatabaseService } from "../database/database.service";
import {
  PushPlatform,
  RegisterPushTokenDto,
  RegisterWebPushSubscriptionDto,
  SendTestPushDto,
  UpdateNotificationPreferencesDto,
} from "./dto/notifications.dto";

const HOUSEHOLD_NOTIFICATION_EVENTS: RealtimeEventType[] =
  REALTIME_EVENTS.filter((eventType) => eventType !== "note.changed");
const HOUSEHOLD_NOTIFICATION_THROTTLE_MINUTES = 15;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expoPushUrl = "https://exp.host/--/api/v2/push/send";

  constructor(private readonly database: DatabaseService) {}

  async registerExpoPushToken(
    household: HouseholdContext,
    user: UserContext,
    dto: RegisterPushTokenDto,
  ): Promise<PushTokenRecord> {
    const expoPushToken = this.normalizeExpoPushToken(dto.expoPushToken);
    const deviceName = dto.deviceName?.trim() ?? "";
    const result = await this.database.query<PushTokenRow>(
      `
        insert into push_tokens (
          household_id,
          household_member_id,
          user_id,
          expo_push_token,
          platform,
          device_name
        )
        values ($1, $2, $3, $4, $5, $6)
        on conflict (expo_push_token) do update
        set
          household_id = excluded.household_id,
          household_member_id = excluded.household_member_id,
          user_id = excluded.user_id,
          platform = excluded.platform,
          device_name = excluded.device_name,
          enabled = true,
          last_registered_at = now()
        returning
          id,
          household_id,
          household_member_id,
          user_id,
          expo_push_token,
          platform,
          device_name,
          enabled,
          last_registered_at,
          created_at,
          updated_at
      `,
      [
        household.householdId,
        household.memberId,
        user.userId,
        expoPushToken,
        dto.platform,
        deviceName,
      ],
    );

    const token = result.rows[0];

    if (!token) {
      throw new Error("Expected push token record");
    }

    return this.mapPushToken(token);
  }

  async registerWebPushSubscription(
    household: HouseholdContext,
    user: UserContext,
    dto: RegisterWebPushSubscriptionDto,
  ): Promise<WebPushSubscriptionRecord> {
    const endpoint = this.normalizeWebPushEndpoint(dto.endpoint);
    const deviceName = dto.deviceName?.trim() ?? "Przeglądarka";
    const result = await this.database.query<WebPushSubscriptionRow>(
      `
        insert into web_push_subscriptions (
          household_id,
          household_member_id,
          user_id,
          endpoint,
          p256dh,
          auth,
          device_name
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (endpoint) do update
        set
          household_id = excluded.household_id,
          household_member_id = excluded.household_member_id,
          user_id = excluded.user_id,
          p256dh = excluded.p256dh,
          auth = excluded.auth,
          device_name = excluded.device_name,
          enabled = true,
          last_registered_at = now()
        returning *
      `,
      [
        household.householdId,
        household.memberId,
        user.userId,
        endpoint,
        dto.keys.p256dh.trim(),
        dto.keys.auth.trim(),
        deviceName,
      ],
    );
    const subscription = result.rows[0];

    if (!subscription) {
      throw new Error("Expected web push subscription record");
    }

    return this.mapWebPushSubscription(subscription);
  }

  async sendTestPush(
    household: HouseholdContext,
    dto: SendTestPushDto,
  ): Promise<PushSendResult> {
    const recipients = await this.listEnabledTokensForMember(
      household.householdId,
      household.memberId,
    );

    if (recipients.length === 0) {
      return { sent: 0, tickets: [] };
    }

    return this.deliverNotifications(recipients, {
      body: dto.body?.trim() || "Powiadomienia push w HomeApp działają.",
      data: {
        kind: "test",
        url: "/",
      },
      title: dto.title?.trim() || "HomeApp",
    });
  }

  async listPreferences(
    household: HouseholdContext,
  ): Promise<NotificationPreferenceRecord[]> {
    const result = await this.database.query<NotificationPreferenceRow>(
      `
        select event_type, enabled
        from notification_preferences
        where household_id = $1
          and household_member_id = $2
      `,
      [household.householdId, household.memberId],
    );
    const rowsByType = new Map(
      result.rows.map((row) => [row.event_type, row.enabled]),
    );

    return HOUSEHOLD_NOTIFICATION_EVENTS.map((eventType) => ({
      enabled: rowsByType.get(eventType) ?? true,
      eventType,
    }));
  }

  async updatePreferences(
    household: HouseholdContext,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferenceRecord[]> {
    await Promise.all(
      dto.preferences.map((preference) =>
        this.database.query(
          `
            insert into notification_preferences (
              household_id,
              household_member_id,
              event_type,
              enabled
            )
            values ($1, $2, $3, $4)
            on conflict (household_member_id, event_type) do update
            set
              enabled = excluded.enabled,
              updated_at = now()
          `,
          [
            household.householdId,
            household.memberId,
            preference.eventType,
            preference.enabled,
          ],
        ),
      ),
    );

    return this.listPreferences(household);
  }

  async sendHouseholdChangeNotification(input: {
    actorMemberId?: string;
    eventType: RealtimeEventType;
    householdId: string;
    resourceId?: string;
  }): Promise<PushSendResult> {
    if (!input.actorMemberId) {
      return { sent: 0, tickets: [] };
    }

    if (input.eventType === "note.changed") {
      return { sent: 0, tickets: [] };
    }

    const recipients = await this.listEnabledTokensForHouseholdEvent(
      input.householdId,
      input.eventType,
      input.actorMemberId,
    );

    if (recipients.length === 0) {
      return { sent: 0, tickets: [] };
    }

    const shouldSend = await this.claimHouseholdNotificationWindow(
      input.householdId,
      input.eventType,
    );

    if (!shouldSend) {
      return { sent: 0, tickets: [] };
    }

    const actorName = await this.getMemberDisplayName(input.actorMemberId);
    const copy = buildNotificationCopy(input.eventType, actorName);
    const notification = {
      body: copy.body,
      data: {
        eventType: input.eventType,
        kind: "household-change",
        resourceId: input.resourceId,
        url: notificationUrl(input.eventType),
      },
      title: copy.title,
    };

    try {
      return await this.deliverNotifications(recipients, notification);
    } catch (error) {
      this.logger.warn(
        "Failed to send household change push notification",
        error,
      );
      return { sent: 0, tickets: [] };
    }
  }

  async sendCalendarEventReminder(input: {
    eventDate: string;
    eventTime: string | null;
    householdId: string;
    reminderOffsetMinutes: number | null;
    title: string;
  }): Promise<PushSendResult> {
    const recipients = await this.listEnabledTokensForHouseholdEvent(
      input.householdId,
      "calendar.changed",
    );

    if (recipients.length === 0) {
      return { sent: 0, tickets: [] };
    }

    const startsAt = formatCalendarReminderStart(
      input.eventDate,
      input.eventTime,
    );
    const reminderTitle = formatCalendarReminderTitle(
      input.reminderOffsetMinutes,
      input.title,
    );
    const notification = {
      body: startsAt,
      data: {
        eventDate: input.eventDate,
        eventTime: input.eventTime ?? "",
        eventType: "calendar.changed",
        kind: "calendar-reminder",
        reminderOffsetMinutes: String(input.reminderOffsetMinutes ?? ""),
        url: "/kalendarz",
      },
      title: reminderTitle,
    };

    try {
      return await this.deliverNotifications(recipients, notification);
    } catch (error) {
      this.logger.warn(
        "Failed to send calendar reminder push notification",
        error,
      );
      return { sent: 0, tickets: [] };
    }
  }

  async sendCleaningTaskReminder(input: {
    householdId: string;
    location: string | null;
    nextDueAt: string;
    taskName: string;
  }): Promise<PushSendResult> {
    const recipients = await this.listEnabledTokensForHouseholdEvent(
      input.householdId,
      "cleaning.changed",
    );

    if (recipients.length === 0) {
      return { sent: 0, tickets: [] };
    }

    const taskLabel = input.location
      ? `${input.taskName} w ${input.location}`
      : input.taskName;
    const notification = {
      body: taskLabel,
      data: {
        eventType: "cleaning.changed",
        kind: "cleaning-reminder",
        nextDueAt: input.nextDueAt,
        url: "/dom",
      },
      title: "Mija termin sprzątania",
    };

    try {
      return await this.deliverNotifications(recipients, notification);
    } catch (error) {
      this.logger.warn(
        "Failed to send cleaning reminder push notification",
        error,
      );
      return { sent: 0, tickets: [] };
    }
  }

  private async listEnabledTokensForMember(
    householdId: string,
    householdMemberId: string,
  ): Promise<PushRecipient[]> {
    const result = await this.database.query<PushRecipientRow>(
      `
        select 'expo'::text as provider,
          expo_push_token as endpoint,
          null::text as p256dh,
          null::text as auth
        from push_tokens
        where household_id = $1 and household_member_id = $2 and enabled = true
        union all
        select 'web_push'::text as provider,
          endpoint,
          p256dh,
          auth
        from web_push_subscriptions
        where household_id = $1 and household_member_id = $2 and enabled = true
      `,
      [householdId, householdMemberId],
    );

    return result.rows.map((row) => this.mapPushRecipient(row));
  }

  private async listEnabledTokensForHouseholdEvent(
    householdId: string,
    eventType: RealtimeEventType,
    actorMemberId?: string,
  ): Promise<PushRecipient[]> {
    const result = await this.database.query<PushRecipientRow>(
      `
        select distinct on (recipient.provider, recipient.endpoint)
          recipient.provider,
          recipient.endpoint,
          recipient.p256dh,
          recipient.auth
        from (
          select 'expo'::text as provider,
            pt.expo_push_token as endpoint,
            null::text as p256dh,
            null::text as auth
          from push_tokens pt
          left join notification_preferences np
            on np.household_member_id = pt.household_member_id and np.event_type = $2
          where pt.household_id = $1
            and ($3::uuid is null or pt.household_member_id <> $3)
            and pt.enabled = true
            and coalesce(np.enabled, true) = true
          union all
          select 'web_push'::text as provider,
            wp.endpoint,
            wp.p256dh,
            wp.auth
          from web_push_subscriptions wp
          left join notification_preferences np
            on np.household_member_id = wp.household_member_id and np.event_type = $2
          where wp.household_id = $1
            and ($3::uuid is null or wp.household_member_id <> $3)
            and wp.enabled = true
            and coalesce(np.enabled, true) = true
        ) recipient
        order by recipient.provider, recipient.endpoint
      `,
      [householdId, eventType, actorMemberId ?? null],
    );

    return result.rows.map((row) => this.mapPushRecipient(row));
  }

  private async claimHouseholdNotificationWindow(
    householdId: string,
    eventType: RealtimeEventType,
  ): Promise<boolean> {
    const result = await this.database.query<{ allowed: boolean }>(
      `
        insert into notification_delivery_rate_limits (
          household_id,
          event_type,
          last_sent_at
        )
        values ($1, $2, now())
        on conflict (household_id, event_type) do update
        set last_sent_at = excluded.last_sent_at
        where notification_delivery_rate_limits.last_sent_at <=
          now() - ($3::integer * interval '1 minute')
        returning true as allowed
      `,
      [householdId, eventType, HOUSEHOLD_NOTIFICATION_THROTTLE_MINUTES],
    );

    return Boolean(result.rows[0]?.allowed);
  }

  private async getMemberDisplayName(memberId: string): Promise<string> {
    const result = await this.database.query<{ display_name: string }>(
      `
        select u.display_name
        from household_members hm
        join users u on u.id = hm.user_id
        where hm.id = $1
      `,
      [memberId],
    );

    return result.rows[0]?.display_name?.trim() || "Domownik";
  }

  private async deliverNotifications(
    recipients: PushRecipient[],
    notification: PushNotification,
  ): Promise<PushSendResult> {
    const expoRecipients = recipients.filter(
      (recipient) => recipient.provider === "expo",
    );
    const webRecipients = recipients.filter(
      (recipient) => recipient.provider === "web_push",
    );
    const tickets: ExpoPushTicket[] = [];

    if (expoRecipients.length > 0) {
      const expoTickets = await this.sendExpoMessages(
        expoRecipients.map((recipient) => ({
          ...notification,
          sound: "default" as const,
          to: recipient.endpoint,
        })),
      );
      await Promise.all(
        expoTickets.map((ticket, index) =>
          ticket.status === "error" &&
          ticket.details?.error === "DeviceNotRegistered"
            ? this.disableToken(expoRecipients[index]!.endpoint)
            : undefined,
        ),
      );
      tickets.push(...expoTickets);
    }

    const webTickets = await Promise.all(
      webRecipients.map(async (recipient): Promise<ExpoPushTicket> => {
        try {
          await this.sendWebPushNotification(recipient, notification);
          return { status: "ok" };
        } catch (error) {
          if (isExpiredWebPushSubscription(error)) {
            await this.disableWebPushSubscription(recipient.endpoint);
          }
          this.logger.warn("Failed to send browser push notification", error);
          return {
            details: { error: isExpiredWebPushSubscription(error) ? "DeviceNotRegistered" : "WebPushError" },
            message: error instanceof Error ? error.message : "Web push failed",
            status: "error",
          };
        }
      }),
    );
    tickets.push(...webTickets);

    return { sent: recipients.length, tickets };
  }

  private async sendWebPushNotification(
    recipient: PushRecipient,
    notification: PushNotification,
  ): Promise<void> {
    const env = loadEnv();

    if (!env.WEB_PUSH_VAPID_PUBLIC_KEY || !env.WEB_PUSH_VAPID_PRIVATE_KEY) {
      throw new BadGatewayException("Web push is not configured");
    }
    if (!recipient.p256dh || !recipient.auth) {
      throw new BadRequestException("Web push subscription is incomplete");
    }

    webPush.setVapidDetails(
      env.WEB_PUSH_SUBJECT,
      env.WEB_PUSH_VAPID_PUBLIC_KEY,
      env.WEB_PUSH_VAPID_PRIVATE_KEY,
    );
    await webPush.sendNotification(
      {
        endpoint: recipient.endpoint,
        keys: { auth: recipient.auth, p256dh: recipient.p256dh },
      },
      JSON.stringify({ ...notification, icon: "/homeapp-icon.png" }),
      { TTL: 60 * 60 },
    );
  }

  private async sendExpoMessages(
    messages: ExpoPushMessage[],
  ): Promise<ExpoPushTicket[]> {
    const response = await fetch(this.expoPushUrl, {
      body: JSON.stringify(messages),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new BadGatewayException("Expo push service rejected the request");
    }

    const body = (await response.json()) as ExpoPushResponse;

    if (!Array.isArray(body.data)) {
      throw new BadGatewayException(
        "Expo push service returned an invalid response",
      );
    }

    return body.data;
  }

  private async disableToken(expoPushToken: string): Promise<void> {
    await this.database.query(
      `
        update push_tokens
        set enabled = false
        where expo_push_token = $1
      `,
      [expoPushToken],
    );
  }

  private async disableWebPushSubscription(endpoint: string): Promise<void> {
    await this.database.query(
      `update web_push_subscriptions set enabled = false where endpoint = $1`,
      [endpoint],
    );
  }

  private normalizeExpoPushToken(expoPushToken: string): string {
    const normalized = expoPushToken.trim();

    if (!/^(ExpoPushToken|ExponentPushToken)\[[^\]]+\]$/.test(normalized)) {
      throw new BadRequestException("Invalid Expo push token");
    }

    return normalized;
  }

  private normalizeWebPushEndpoint(endpoint: string): string {
    const normalized = endpoint.trim();

    try {
      if (new URL(normalized).protocol !== "https:") {
        throw new Error("Web push endpoint must use HTTPS");
      }
    } catch {
      throw new BadRequestException("Invalid web push endpoint");
    }

    return normalized;
  }

  private mapPushRecipient(row: PushRecipientRow): PushRecipient {
    return {
      auth: row.auth,
      endpoint: row.endpoint ?? row.expo_push_token ?? "",
      p256dh: row.p256dh,
      provider: row.provider === "web_push" ? "web_push" : "expo",
    };
  }

  private mapPushToken(row: PushTokenRow): PushTokenRecord {
    return {
      createdAt: row.created_at,
      deviceName: row.device_name,
      enabled: row.enabled,
      expoPushToken: row.expo_push_token,
      householdId: row.household_id,
      householdMemberId: row.household_member_id,
      id: row.id,
      lastRegisteredAt: row.last_registered_at,
      platform: row.platform,
      updatedAt: row.updated_at,
      userId: row.user_id,
    };
  }

  private mapWebPushSubscription(row: WebPushSubscriptionRow): WebPushSubscriptionRecord {
    return {
      createdAt: row.created_at,
      deviceName: row.device_name,
      enabled: row.enabled,
      householdId: row.household_id,
      householdMemberId: row.household_member_id,
      id: row.id,
      lastRegisteredAt: row.last_registered_at,
      platform: "web",
      updatedAt: row.updated_at,
      userId: row.user_id,
    };
  }
}

function buildNotificationCopy(
  eventType: RealtimeEventType,
  actorName: string,
): { body: string; title: string } {
  const actor = actorName.trim() || "Domownik";

  if (eventType.startsWith("finance.")) {
    return {
      body: `${actor} zmienił finanse domu.`,
      title: "Finanse",
    };
  }

  const copies: Partial<
    Record<RealtimeEventType, { body: string; title: string }>
  > = {
    "annual_cost.changed": {
      body: `${actor} zmienił koszty roczne.`,
      title: "Koszty roczne",
    },
    "attachment.changed": {
      body: `${actor} zmienił pliki w domu.`,
      title: "Pliki",
    },
    "calendar.changed": {
      body: `${actor} zmienił kalendarz.`,
      title: "Kalendarz",
    },
    "cleaning.changed": {
      body: `${actor} zmienił pozycje cykliczne.`,
      title: "Cykliczne",
    },
    "data.changed": {
      body: `${actor} zmienił dane domowe.`,
      title: "Dane",
    },
    "household.changed": {
      body: `${actor} zmienił ustawienia lub skład domu.`,
      title: "Dom",
    },
    "meal.changed": {
      body: `${actor} zmienił plan posiłków.`,
      title: "Plan posiłków",
    },
    "note.changed": {
      body: `${actor} zmienił notatki.`,
      title: "Notatki",
    },
    "permissions.changed": {
      body: `${actor} zmienił uprawnienia domowników.`,
      title: "Uprawnienia",
    },
    "shopping.changed": {
      body: `${actor} zmienił listę zakupów.`,
      title: "Zakupy",
    },
    "todo.changed": {
      body: `${actor} zmienił listę do zrobienia.`,
      title: "Do zrobienia",
    },
  };

  return (
    copies[eventType] ?? {
      body: `${actor} zmienił coś w domu.`,
      title: "HomeApp",
    }
  );
}

function notificationUrl(eventType: RealtimeEventType): string {
  if (eventType.startsWith("finance.")) return "/finanse";
  if (eventType === "calendar.changed") return "/kalendarz";
  if (eventType === "cleaning.changed") return "/dom";
  if (eventType === "meal.changed") return "/posilki";
  if (eventType === "shopping.changed") return "/zakupy";
  if (eventType === "todo.changed") return "/zadania";
  if (eventType === "household.changed" || eventType === "permissions.changed") {
    return "/domownicy";
  }
  return "/";
}

function isExpiredWebPushSubscription(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return false;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return statusCode === 404 || statusCode === 410;
}

function formatCalendarReminderStart(
  eventDate: string,
  eventTime: string | null,
): string {
  const date = formatCalendarReminderDate(eventDate);
  const time = eventTime?.slice(0, 5).trim();

  return time ? `${date} o ${time}` : date;
}

function formatCalendarReminderTitle(
  reminderOffsetMinutes: number | null,
  eventTitle: string,
): string {
  if (reminderOffsetMinutes === 1440) {
    return `Jutro: ${eventTitle}`;
  }

  if (reminderOffsetMinutes === 60) {
    return `Za 1 godz.: ${eventTitle}`;
  }

  if (reminderOffsetMinutes && reminderOffsetMinutes > 0) {
    return `Za ${reminderOffsetMinutes} min: ${eventTitle}`;
  }

  return `Wkrótce: ${eventTitle}`;
}

function formatCalendarReminderDate(eventDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eventDate);

  if (!match) {
    return eventDate;
  }

  return `${match[3]}.${match[2]}.${match[1]}`;
}

interface ExpoPushMessage {
  body: string;
  data?: Record<string, unknown>;
  sound: "default";
  title: string;
  to: string;
}

interface ExpoPushResponse {
  data?: ExpoPushTicket[];
}

interface ExpoPushTicket {
  details?: {
    error?: string;
  };
  id?: string;
  message?: string;
  status: "ok" | "error";
}

interface PushNotification {
  body: string;
  data?: Record<string, unknown>;
  title: string;
}

interface PushRecipientRow {
  auth?: string | null;
  endpoint?: string;
  expo_push_token?: string;
  p256dh?: string | null;
  provider?: string;
}

interface PushRecipient {
  auth?: string | null;
  endpoint: string;
  p256dh?: string | null;
  provider: "expo" | "web_push";
}

interface PushTokenRow {
  created_at: string;
  device_name: string;
  enabled: boolean;
  expo_push_token: string;
  household_id: string;
  household_member_id: string;
  id: string;
  last_registered_at: string;
  platform: PushPlatform;
  updated_at: string;
  user_id: string;
}

interface WebPushSubscriptionRow {
  auth: string;
  created_at: string;
  device_name: string;
  enabled: boolean;
  endpoint: string;
  household_id: string;
  household_member_id: string;
  id: string;
  last_registered_at: string;
  p256dh: string;
  updated_at: string;
  user_id: string;
}

export interface PushSendResult {
  sent: number;
  tickets: ExpoPushTicket[];
}

export interface PushTokenRecord {
  createdAt: string;
  deviceName: string;
  enabled: boolean;
  expoPushToken: string;
  householdId: string;
  householdMemberId: string;
  id: string;
  lastRegisteredAt: string;
  platform: PushPlatform;
  updatedAt: string;
  userId: string;
}

export type WebPushSubscriptionRecord = Omit<PushTokenRecord, "expoPushToken">;

interface NotificationPreferenceRow {
  enabled: boolean;
  event_type: RealtimeEventType;
}

export interface NotificationPreferenceRecord {
  enabled: boolean;
  eventType: RealtimeEventType;
}

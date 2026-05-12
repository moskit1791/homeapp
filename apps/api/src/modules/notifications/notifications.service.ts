import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { REALTIME_EVENTS, RealtimeEventType } from '@homeapp/shared-types';
import { HouseholdContext, UserContext } from '../../shared/request-context';
import { DatabaseService } from '../database/database.service';
import {
  PushPlatform,
  RegisterPushTokenDto,
  SendTestPushDto,
  UpdateNotificationPreferencesDto
} from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expoPushUrl = 'https://exp.host/--/api/v2/push/send';

  constructor(private readonly database: DatabaseService) {}

  async registerExpoPushToken(
    household: HouseholdContext,
    user: UserContext,
    dto: RegisterPushTokenDto
  ): Promise<PushTokenRecord> {
    const expoPushToken = this.normalizeExpoPushToken(dto.expoPushToken);
    const deviceName = dto.deviceName?.trim() ?? '';
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
        deviceName
      ]
    );

    const token = result.rows[0];

    if (!token) {
      throw new Error('Expected push token record');
    }

    return this.mapPushToken(token);
  }

  async sendTestPush(
    household: HouseholdContext,
    dto: SendTestPushDto
  ): Promise<PushSendResult> {
    const tokens = await this.listEnabledTokensForMember(
      household.householdId,
      household.memberId
    );

    if (tokens.length === 0) {
      return { sent: 0, tickets: [] };
    }

    const messages = tokens.map((token) => ({
      body: dto.body?.trim() || 'Powiadomienia push w HomeApp działają.',
      data: {
        kind: 'test'
      },
      sound: 'default' as const,
      title: dto.title?.trim() || 'HomeApp',
      to: token.expoPushToken
    }));
    const tickets = await this.sendExpoMessages(messages);

    await Promise.all(
      tickets.map((ticket, index) =>
        ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
          ? this.disableToken(tokens[index]!.expoPushToken)
          : undefined
      )
    );

    return {
      sent: messages.length,
      tickets
    };
  }

  async listPreferences(household: HouseholdContext): Promise<NotificationPreferenceRecord[]> {
    const result = await this.database.query<NotificationPreferenceRow>(
      `
        select event_type, enabled
        from notification_preferences
        where household_id = $1
          and household_member_id = $2
      `,
      [household.householdId, household.memberId]
    );
    const rowsByType = new Map(result.rows.map((row) => [row.event_type, row.enabled]));

    return REALTIME_EVENTS.map((eventType) => ({
      enabled: rowsByType.get(eventType) ?? true,
      eventType
    }));
  }

  async updatePreferences(
    household: HouseholdContext,
    dto: UpdateNotificationPreferencesDto
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
            preference.enabled
          ]
        )
      )
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

    const recipients = await this.listEnabledTokensForHouseholdEvent(
      input.householdId,
      input.eventType,
      input.actorMemberId
    );

    if (recipients.length === 0) {
      return { sent: 0, tickets: [] };
    }

    const actorName = await this.getMemberDisplayName(input.actorMemberId);
    const copy = buildNotificationCopy(input.eventType, actorName);
    const messages = recipients.map((token) => ({
      body: copy.body,
      data: {
        eventType: input.eventType,
        kind: 'household-change',
        resourceId: input.resourceId
      },
      sound: 'default' as const,
      title: copy.title,
      to: token.expoPushToken
    }));

    try {
      const tickets = await this.sendExpoMessages(messages);

      await Promise.all(
        tickets.map((ticket, index) =>
          ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
            ? this.disableToken(recipients[index]!.expoPushToken)
            : undefined
        )
      );

      return {
        sent: messages.length,
        tickets
      };
    } catch (error) {
      this.logger.warn('Failed to send household change push notification', error);
      return { sent: 0, tickets: [] };
    }
  }

  async sendCalendarEventReminder(input: {
    eventDate: string;
    eventTime: string | null;
    householdId: string;
    title: string;
  }): Promise<PushSendResult> {
    const recipients = await this.listEnabledTokensForHouseholdEvent(
      input.householdId,
      'calendar.changed'
    );

    if (recipients.length === 0) {
      return { sent: 0, tickets: [] };
    }

    const time = input.eventTime ? ` o ${input.eventTime.slice(0, 5)}` : '';
    const messages = recipients.map((token) => ({
      body: `${input.eventDate}${time}: ${input.title}`,
      data: {
        eventType: 'calendar.changed',
        kind: 'calendar-reminder'
      },
      sound: 'default' as const,
      title: 'Nadchodzące wydarzenie',
      to: token.expoPushToken
    }));

    try {
      const tickets = await this.sendExpoMessages(messages);

      await Promise.all(
        tickets.map((ticket, index) =>
          ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
            ? this.disableToken(recipients[index]!.expoPushToken)
            : undefined
        )
      );

      return {
        sent: messages.length,
        tickets
      };
    } catch (error) {
      this.logger.warn('Failed to send calendar reminder push notification', error);
      return { sent: 0, tickets: [] };
    }
  }

  private async listEnabledTokensForMember(
    householdId: string,
    householdMemberId: string
  ): Promise<PushTokenRecord[]> {
    const result = await this.database.query<PushTokenRow>(
      `
        select
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
        from push_tokens
        where household_id = $1
          and household_member_id = $2
          and enabled = true
      `,
      [householdId, householdMemberId]
    );

    return result.rows.map((row) => this.mapPushToken(row));
  }

  private async listEnabledTokensForHouseholdEvent(
    householdId: string,
    eventType: RealtimeEventType,
    actorMemberId?: string
  ): Promise<PushTokenRecord[]> {
    const result = await this.database.query<PushTokenRow>(
      `
        select distinct on (pt.expo_push_token)
          pt.id,
          pt.household_id,
          pt.household_member_id,
          pt.user_id,
          pt.expo_push_token,
          pt.platform,
          pt.device_name,
          pt.enabled,
          pt.last_registered_at,
          pt.created_at,
          pt.updated_at
        from push_tokens pt
        left join notification_preferences np
          on np.household_member_id = pt.household_member_id
          and np.event_type = $2
        where pt.household_id = $1
          and ($3::uuid is null or pt.household_member_id <> $3)
          and pt.enabled = true
          and coalesce(np.enabled, true) = true
      `,
      [householdId, eventType, actorMemberId ?? null]
    );

    return result.rows.map((row) => this.mapPushToken(row));
  }

  private async getMemberDisplayName(memberId: string): Promise<string> {
    const result = await this.database.query<{ display_name: string }>(
      `
        select u.display_name
        from household_members hm
        join users u on u.id = hm.user_id
        where hm.id = $1
      `,
      [memberId]
    );

    return result.rows[0]?.display_name?.trim() || 'Domownik';
  }

  private async sendExpoMessages(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    const response = await fetch(this.expoPushUrl, {
      body: JSON.stringify(messages),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'POST'
    });

    if (!response.ok) {
      throw new BadGatewayException('Expo push service rejected the request');
    }

    const body = (await response.json()) as ExpoPushResponse;

    if (!Array.isArray(body.data)) {
      throw new BadGatewayException('Expo push service returned an invalid response');
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
      [expoPushToken]
    );
  }

  private normalizeExpoPushToken(expoPushToken: string): string {
    const normalized = expoPushToken.trim();

    if (!/^(ExpoPushToken|ExponentPushToken)\[[^\]]+\]$/.test(normalized)) {
      throw new BadRequestException('Invalid Expo push token');
    }

    return normalized;
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
      userId: row.user_id
    };
  }
}

function buildNotificationCopy(
  eventType: RealtimeEventType,
  actorName: string
): { body: string; title: string } {
  const actor = actorName.trim() || 'Domownik';

  if (eventType.startsWith('finance.')) {
    return {
      body: `${actor} zmienił finanse domu.`,
      title: 'Finanse'
    };
  }

  const copies: Partial<Record<RealtimeEventType, { body: string; title: string }>> = {
    'annual_cost.changed': {
      body: `${actor} zmienił koszty roczne.`,
      title: 'Koszty roczne'
    },
    'attachment.changed': {
      body: `${actor} zmienił pliki w domu.`,
      title: 'Pliki'
    },
    'calendar.changed': {
      body: `${actor} zmienił kalendarz.`,
      title: 'Kalendarz'
    },
    'cleaning.changed': {
      body: `${actor} zmienił sprzątanie.`,
      title: 'Sprzątanie'
    },
    'data.changed': {
      body: `${actor} zmienił dane domowe.`,
      title: 'Dane'
    },
    'household.changed': {
      body: `${actor} zmienił ustawienia lub skład domu.`,
      title: 'Dom'
    },
    'meal.changed': {
      body: `${actor} zmienił plan posiłków.`,
      title: 'Plan posiłków'
    },
    'note.changed': {
      body: `${actor} zmienił notatki.`,
      title: 'Notatki'
    },
    'permissions.changed': {
      body: `${actor} zmienił uprawnienia domowników.`,
      title: 'Uprawnienia'
    },
    'shopping.changed': {
      body: `${actor} zmienił listę zakupów.`,
      title: 'Zakupy'
    },
    'todo.changed': {
      body: `${actor} zmienił zadania.`,
      title: 'To-do'
    }
  };

  return copies[eventType] ?? {
    body: `${actor} zmienił coś w domu.`,
    title: 'HomeApp'
  };
}

interface ExpoPushMessage {
  body: string;
  data?: Record<string, unknown>;
  sound: 'default';
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
  status: 'ok' | 'error';
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

interface NotificationPreferenceRow {
  enabled: boolean;
  event_type: RealtimeEventType;
}

export interface NotificationPreferenceRecord {
  enabled: boolean;
  eventType: RealtimeEventType;
}

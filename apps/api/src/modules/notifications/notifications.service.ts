import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { HouseholdContext, UserContext } from '../../shared/request-context';
import { DatabaseService } from '../database/database.service';
import {
  PushPlatform,
  RegisterPushTokenDto,
  SendTestPushDto
} from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
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

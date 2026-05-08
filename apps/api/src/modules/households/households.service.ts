import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { HouseholdMemberRole } from '@homeapp/shared-types';
import { PoolClient } from 'pg';
import { UserContext } from '../../shared/request-context';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CreateHouseholdDto,
  InviteMemberDto,
  PatchMemberPermissionsDto,
  UpdateHouseholdDto
} from './dto/household.dto';

@Injectable()
export class HouseholdsService {
  private readonly logger = new Logger(HouseholdsService.name);
  private readonly expoPushUrl = 'https://exp.host/--/api/v2/push/send';

  constructor(
    private readonly database: DatabaseService,
    private readonly mailService: MailService,
    private readonly realtime: RealtimeService
  ) {}

  async createHousehold(user: UserContext, dto: CreateHouseholdDto) {
    return this.database.transaction(async (client) => {
      const existing = await client.query(
        `
          select 1
          from household_members
          where user_id = $1
            and is_active = true
          limit 1
        `,
        [user.userId]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        throw new BadRequestException('User already belongs to a household');
      }

      const householdResult = await client.query<HouseholdRow>(
        `
          insert into households (
            name,
            currency_code,
            meal_slots_per_day
          )
          values ($1, $2, $3)
          returning id, name, currency_code, week_starts_on, meal_slots_per_day
        `,
        [
          dto.name,
          dto.currencyCode?.toUpperCase() ?? 'PLN',
          dto.mealSlotsPerDay ?? 3
        ]
      );
      const household = this.mapHousehold(householdResult.rows[0]);

      const memberResult = await client.query<ActiveMembershipRow>(
        `
          insert into household_members (
            household_id,
            user_id,
            role,
            is_active
          )
          values ($1, $2, 'owner', true)
          returning id, household_id, role
        `,
        [household.id, user.userId]
      );

      const membership = memberResult.rows[0];

      if (!membership) {
        throw new Error('Expected owner membership');
      }

      await this.createInitialBudgetMonth(client, household.id, membership.id);
      await this.createDefaultShoppingLists(client, household.id);
      await client.query(
        `
          update users
          set account_status = 'active'
          where id = $1
            and account_status = 'inactive'
        `,
        [user.userId]
      );

      const created = {
        household,
        membership: {
          householdId: membership.household_id,
          memberId: membership.id,
          role: membership.role
        }
      };
      this.realtime.publish(household.id, 'household.changed', household.id);

      return created;
    });
  }

  async getHousehold(householdId: string): Promise<HouseholdRecord> {
    const result = await this.database.query<HouseholdRow>(
      `
        select id, name, currency_code, week_starts_on, meal_slots_per_day
        from households
        where id = $1
      `,
      [householdId]
    );

    return this.mapHousehold(result.rows[0]);
  }

  async updateHousehold(
    householdId: string,
    dto: UpdateHouseholdDto
  ): Promise<HouseholdRecord> {
    const current = await this.getHousehold(householdId);
    const result = await this.database.query<HouseholdRow>(
      `
        update households
        set
          name = $2,
          currency_code = $3,
          meal_slots_per_day = $4
        where id = $1
        returning id, name, currency_code, week_starts_on, meal_slots_per_day
      `,
      [
        householdId,
        dto.name ?? current.name,
        dto.currencyCode?.toUpperCase() ?? current.currencyCode,
        dto.mealSlotsPerDay ?? current.mealSlotsPerDay
      ]
    );

    const household = this.mapHousehold(result.rows[0]);
    this.realtime.publish(householdId, 'household.changed', household.id);

    return household;
  }

  async listMembers(householdId: string): Promise<MemberRecord[]> {
    const result = await this.database.query<MemberRow>(
      `
        select
          hm.id,
          hm.household_id,
          hm.user_id,
          hm.role,
          hm.is_active,
          hm.joined_at,
          u.email,
          u.display_name
        from household_members hm
        join users u on u.id = hm.user_id
        where hm.household_id = $1
          and hm.is_active = true
        order by hm.role asc, u.display_name asc
      `,
      [householdId]
    );

    return result.rows.map((row) => ({
      displayName: row.display_name,
      email: row.email,
      householdId: row.household_id,
      id: row.id,
      isActive: row.is_active,
      joinedAt: row.joined_at,
      role: row.role,
      userId: row.user_id
    }));
  }

  async createInvitation(householdId: string, invitedByUserId: string, dto: InviteMemberDto) {
    const email = this.normalizeEmail(dto.email);
    await this.ensureOwnerCanInvite(householdId, invitedByUserId);
    await this.ensureCanInviteEmail(householdId, email);
    const context = await this.getInvitationContext(householdId, invitedByUserId);

    const token = randomBytes(32).toString('hex');
    const result = await this.database.query<InvitationRow>(
      `
        insert into invitations (
          household_id,
          email,
          invited_by_user_id,
          token,
          expires_at
        )
        values ($1, $2, $3, $4, now() + interval '7 days')
        returning id, household_id, email, token, expires_at, accepted_at
      `,
      [householdId, email, invitedByUserId, token]
    );

    const invitation = result.rows[0];

    if (!invitation) {
      throw new Error('Expected invitation record');
    }

    const created = {
      acceptedAt: invitation.accepted_at,
      email: invitation.email,
      expiresAt: invitation.expires_at,
      householdId: invitation.household_id,
      id: invitation.id,
      notificationSent: 0,
      token: invitation.token
    };

    try {
      await this.mailService.sendHouseholdInvitation({
        email,
        householdName: context.household_name,
        invitedByDisplayName: context.inviter_display_name,
        token
      });
    } catch (error) {
      await this.database.query(
        `
          delete from invitations
          where id = $1
            and accepted_at is null
        `,
        [invitation.id]
      );

      throw error;
    }

    created.notificationSent = await this.sendInvitationPushIfPossible({
      email,
      householdName: context.household_name,
      invitedByDisplayName: context.inviter_display_name,
      token
    });
    this.realtime.publish(householdId, 'household.changed', invitation.id);

    return created;
  }

  async removeMember(householdId: string, memberId: string): Promise<boolean> {
    const result = await this.database.query(
      `
        update household_members
        set
          is_active = false,
          removed_at = now()
        where household_id = $1
          and id = $2
          and role <> 'owner'
          and is_active = true
      `,
      [householdId, memberId]
    );

    const removed = Boolean(result.rowCount && result.rowCount > 0);

    if (removed) {
      this.realtime.publish(householdId, 'household.changed', memberId);
    }

    return removed;
  }

  async updateMemberPermissions(
    householdId: string,
    memberId: string,
    dto: PatchMemberPermissionsDto
  ) {
    return this.database.transaction(async (client) => {
      const member = await client.query<{ id: string; role: HouseholdMemberRole }>(
        `
          select id, role
          from household_members
          where household_id = $1
            and id = $2
            and is_active = true
          limit 1
        `,
        [householdId, memberId]
      );

      if (!member.rows[0]) {
        throw new BadRequestException('Member not found');
      }

      if (member.rows[0].role === 'owner') {
        throw new BadRequestException('Owner permissions are implicit and cannot be edited');
      }

      for (const permission of dto.permissions) {
        await client.query(
          `
            insert into member_permissions (
              household_member_id,
              module_key,
              can_read,
              can_create,
              can_update,
              can_delete
            )
            values ($1, $2, $3, $4, $5, $6)
            on conflict (household_member_id, module_key) do update
            set
              can_read = excluded.can_read,
              can_create = excluded.can_create,
              can_update = excluded.can_update,
              can_delete = excluded.can_delete
          `,
          [
            memberId,
            permission.moduleKey,
            permission.canRead,
            permission.canCreate,
            permission.canUpdate,
            permission.canDelete
          ]
        );
      }

      const updated = {
        memberId,
        permissions: dto.permissions
      };
      this.realtime.publish(householdId, 'permissions.changed', memberId);

      return updated;
    });
  }

  async findActiveMembershipForUser(userId: string): Promise<ActiveMembership | null> {
    const result = await this.database.query<ActiveMembershipRow>(
      `
        select
          id,
          household_id,
          role
        from household_members
        where user_id = $1
          and is_active = true
        limit 1
      `,
      [userId]
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      householdId: row.household_id,
      memberId: row.id,
      role: row.role
    };
  }

  private async ensureOwnerCanInvite(householdId: string, invitedByUserId: string): Promise<void> {
    const result = await this.database.query<{ role: HouseholdMemberRole }>(
      `
        select role
        from household_members
        where household_id = $1
          and user_id = $2
          and is_active = true
        limit 1
      `,
      [householdId, invitedByUserId]
    );
    const member = result.rows[0];

    if (!member || member.role !== 'owner') {
      throw new ForbiddenException('Only the household owner can invite members');
    }
  }

  private async ensureCanInviteEmail(householdId: string, email: string): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);
    const existingAnyMember = await this.database.query<{ id: string }>(
      `
        select hm.id
        from household_members hm
        join users u on u.id = hm.user_id
        where hm.is_active = true
          and lower(u.email::text) = $1
        limit 1
      `,
      [normalizedEmail]
    );

    if (existingAnyMember.rows[0]) {
      throw new ConflictException('User already belongs to a household');
    }

    const existingMember = await this.database.query<{ id: string }>(
      `
        select hm.id
        from household_members hm
        join users u on u.id = hm.user_id
        where hm.household_id = $1
          and hm.is_active = true
          and lower(u.email::text) = $2
        limit 1
      `,
      [householdId, normalizedEmail]
    );

    if (existingMember.rows[0]) {
      throw new ConflictException('User is already an active household member');
    }

    const activeInvitation = await this.database.query<{ id: string }>(
      `
        select id
        from invitations
        where household_id = $1
          and lower(email::text) = $2
          and accepted_at is null
          and expires_at > now()
        limit 1
      `,
      [householdId, normalizedEmail]
    );

    if (activeInvitation.rows[0]) {
      throw new ConflictException('Active invitation already exists for this email');
    }
  }

  private async getInvitationContext(
    householdId: string,
    invitedByUserId: string
  ): Promise<InvitationContextRow> {
    const result = await this.database.query<InvitationContextRow>(
      `
        select
          h.name as household_name,
          u.display_name as inviter_display_name
        from households h
        join users u on u.id = $2
        where h.id = $1
        limit 1
      `,
      [householdId, invitedByUserId]
    );
    const row = result.rows[0];

    if (!row) {
      throw new BadRequestException('Household not found');
    }

    return row;
  }

  private async sendInvitationPushIfPossible(input: {
    email: string;
    householdName: string;
    invitedByDisplayName: string;
    token: string;
  }): Promise<number> {
    const tokens = await this.database.query<{ expo_push_token: string }>(
      `
        select distinct pt.expo_push_token
        from users u
        join push_tokens pt on pt.user_id = u.id
        where lower(u.email::text) = $1
          and pt.enabled = true
      `,
      [this.normalizeEmail(input.email)]
    );

    if (tokens.rows.length === 0) {
      return 0;
    }

    try {
      const response = await fetch(this.expoPushUrl, {
        body: JSON.stringify(
          tokens.rows.map((token) => ({
            body: `${input.invitedByDisplayName} zaprasza Cie do domu ${input.householdName}.`,
            data: {
              kind: 'household-invitation',
              token: input.token
            },
            sound: 'default' as const,
            title: 'Zaproszenie do HomeApp',
            to: token.expo_push_token
          }))
        ),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        method: 'POST'
      });

      if (!response.ok) {
        this.logger.warn(`Expo push rejected invitation notification: ${response.status}`);
        return 0;
      }

      const body = (await response.json()) as ExpoPushResponse;
      const tickets = Array.isArray(body.data) ? body.data : [];
      await Promise.all(
        tickets.map((ticket, index) =>
          ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
            ? this.disablePushToken(tokens.rows[index]!.expo_push_token)
            : undefined
        )
      );

      return tickets.filter((ticket) => ticket.status === 'ok').length;
    } catch (error) {
      this.logger.warn(
        'Failed to send invitation push notification',
        error instanceof Error ? error.stack : undefined
      );
      return 0;
    }
  }

  private async disablePushToken(expoPushToken: string): Promise<void> {
    await this.database.query(
      `
        update push_tokens
        set enabled = false
        where expo_push_token = $1
      `,
      [expoPushToken]
    );
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async createDefaultShoppingLists(client: PoolClient, householdId: string) {
    await client.query(
      `
        insert into shopping_lists (household_id, type, name)
        values
          ($1, 'daily', 'Codzienne'),
          ($1, 'long_term', 'Długoterminowe')
      `,
      [householdId]
    );
  }

  private async createInitialBudgetMonth(
    client: PoolClient,
    householdId: string,
    ownerMemberId: string
  ) {
    const monthResult = await client.query<{ id: string }>(
      `
        insert into budget_months (
          household_id,
          year,
          month,
          is_current
        )
        values (
          $1,
          extract(year from current_date)::integer,
          extract(month from current_date)::integer,
          true
        )
        returning id
      `,
      [householdId]
    );
    const month = monthResult.rows[0];

    if (!month) {
      throw new Error('Expected initial budget month');
    }

    await client.query(
      `
        insert into monthly_incomes (
          budget_month_id,
          owner_member_id,
          amount
        )
        values ($1, $2, 0)
      `,
      [month.id, ownerMemberId]
    );
  }

  private mapHousehold(row: HouseholdRow | undefined): HouseholdRecord {
    if (!row) {
      throw new BadRequestException('Household not found');
    }

    return {
      currencyCode: row.currency_code,
      id: row.id,
      mealSlotsPerDay: row.meal_slots_per_day,
      name: row.name,
      weekStartsOn: row.week_starts_on
    };
  }
}

interface HouseholdRow {
  currency_code: string;
  id: string;
  meal_slots_per_day: number;
  name: string;
  week_starts_on: number;
}

interface MemberRow {
  display_name: string;
  email: string;
  household_id: string;
  id: string;
  is_active: boolean;
  joined_at: string;
  role: HouseholdMemberRole;
  user_id: string;
}

interface InvitationRow {
  accepted_at: string | null;
  email: string;
  expires_at: string;
  household_id: string;
  id: string;
  token: string;
}

interface InvitationContextRow {
  household_name: string;
  inviter_display_name: string;
}

interface ExpoPushResponse {
  data?: ExpoPushTicket[];
}

interface ExpoPushTicket {
  details?: {
    error?: string;
  };
  status: 'ok' | 'error';
}

interface ActiveMembershipRow {
  household_id: string;
  id: string;
  role: HouseholdMemberRole;
}

export interface ActiveMembership {
  householdId: string;
  memberId: string;
  role: HouseholdMemberRole;
}

export interface HouseholdRecord {
  currencyCode: string;
  id: string;
  mealSlotsPerDay: number;
  name: string;
  weekStartsOn: number;
}

export interface MemberRecord {
  displayName: string;
  email: string;
  householdId: string;
  id: string;
  isActive: boolean;
  joinedAt: string;
  role: HouseholdMemberRole;
  userId: string;
}

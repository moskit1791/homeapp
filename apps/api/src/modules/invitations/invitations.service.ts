import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { PoolClient } from 'pg';
import { UserContext } from '../../shared/request-context';
import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  AcceptInvitationDto,
  CompleteInvitationRegistrationDto,
  PreviewInvitationDto
} from './dto/invitation.dto';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly authService: AuthService,
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async previewInvitation(dto: PreviewInvitationDto): Promise<InvitationPreviewRecord> {
    const invitation = await this.findInvitationForPreview(dto.token);

    this.ensureInvitationCanBeUsed(invitation);

    return {
      email: invitation.email,
      expiresAt: invitation.expires_at,
      householdName: invitation.household_name,
      invitedByDisplayName: invitation.invited_by_display_name
    };
  }

  async acceptInvitation(user: UserContext, dto: AcceptInvitationDto): Promise<InvitationAcceptRecord> {
    return this.database.transaction(async (client) => {
      const invitation = await this.findAcceptableInvitation(client, dto.token, user.email);
      const member = await this.acceptInvitationForUser(client, invitation, user.userId);

      const accepted = {
        householdId: invitation.household_id,
        invitationId: invitation.id,
        membership: {
          householdId: member.household_id,
          memberId: member.id,
          role: member.role
        }
      };

      return accepted;
    });
  }

  async completeRegistration(
    dto: CompleteInvitationRegistrationDto
  ): Promise<InvitationRegistrationRecord> {
    if (!dto.acceptedTerms || !dto.acceptedPrivacy) {
      throw new BadRequestException('Legal acceptance is required');
    }

    const displayName = dto.displayName.trim();
    const passwordHash = await hash(dto.password, 12);
    const accepted = await this.database.transaction(async (client) => {
      const invitation = await this.findAcceptableInvitation(client, dto.token);
      const user = await this.createOrActivateInvitedUser(client, {
        displayName,
        email: invitation.email,
        passwordHash
      });
      const member = await this.acceptInvitationForUser(client, invitation, user.id);

      return {
        householdId: invitation.household_id,
        invitationId: invitation.id,
        membership: {
          householdId: member.household_id,
          memberId: member.id,
          role: member.role
        },
        userId: user.id
      };
    });
    const session = await this.authService.issueSessionForUser(accepted.userId);

    return {
      ...session,
      householdId: accepted.householdId,
      invitationId: accepted.invitationId,
      membership: accepted.membership
    };
  }

  private async findInvitationForPreview(token: string): Promise<InvitationPreviewRow> {
    const result = await this.database.query<InvitationPreviewRow>(
      `
        select
          i.id,
          i.household_id,
          i.email,
          i.expires_at,
          i.accepted_at,
          h.name as household_name,
          u.display_name as invited_by_display_name
        from invitations i
        join households h on h.id = i.household_id
        join users u on u.id = i.invited_by_user_id
        where i.token = $1
        limit 1
      `,
      [token]
    );
    const invitation = result.rows[0];

    if (!invitation) {
      throw new BadRequestException('Invalid invitation token');
    }

    return invitation;
  }

  private async findAcceptableInvitation(
    client: PoolClient,
    token: string,
    userEmail?: string
  ): Promise<InvitationRow> {
    const result = await client.query<InvitationRow>(
      `
        select id, household_id, email, expires_at, accepted_at
        from invitations
        where token = $1
        for update
      `,
      [token]
    );
    const invitation = result.rows[0];

    if (!invitation) {
      throw new BadRequestException('Invalid invitation token');
    }

    this.ensureInvitationCanBeUsed(invitation);

    if (userEmail && invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException('Invitation belongs to another email address');
    }

    return invitation;
  }

  private async createOrActivateInvitedUser(
    client: PoolClient,
    input: {
      displayName: string;
      email: string;
      passwordHash: string;
    }
  ): Promise<InvitationUserRecord> {
    const existingResult = await client.query<InvitationUserRow>(
      `
        select
          id,
          account_status,
          email_verified_at,
          password_hash
        from users
        where lower(email::text) = $1
        for update
      `,
      [input.email.toLowerCase()]
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      const inserted = await client.query<{ id: string }>(
        `
          insert into users (
            email,
            display_name,
            password_hash,
            email_verified_at,
            account_status
          )
          values ($1, $2, $3, now(), 'active')
          returning id
        `,
        [input.email, input.displayName, input.passwordHash]
      );
      const user = inserted.rows[0];

      if (!user) {
        throw new Error('Expected invited user record');
      }

      return { id: user.id };
    }

    if (existing.account_status === 'banned') {
      throw new ForbiddenException('Account is banned');
    }

    await this.ensureUserHasNoActiveHousehold(client, existing.id);

    if (existing.email_verified_at && existing.password_hash) {
      throw new ConflictException('Invitation account already exists');
    }

    const updated = await client.query<{ id: string }>(
      `
        update users
        set
          display_name = $2,
          password_hash = $3,
          email_verified_at = coalesce(email_verified_at, now()),
          email_verification_token_hash = null,
          email_verification_expires_at = null,
          account_status = 'active'
        where id = $1
        returning id
      `,
      [existing.id, input.displayName, input.passwordHash]
    );
    const user = updated.rows[0];

    if (!user) {
      throw new Error('Expected invited user record');
    }

    return { id: user.id };
  }

  private async acceptInvitationForUser(
    client: PoolClient,
    invitation: InvitationRow,
    userId: string
  ): Promise<MemberRow> {
    await this.ensureUserHasNoActiveHousehold(client, userId);

    const memberResult = await client.query<MemberRow>(
      `
        insert into household_members (
          household_id,
          user_id,
          role,
          is_active
        )
        values ($1, $2, 'member', true)
        returning id, household_id, user_id, role
      `,
      [invitation.household_id, userId]
    );
    const member = memberResult.rows[0];

    if (!member) {
      throw new Error('Expected accepted household member');
    }

    await client.query(
      `
        update invitations
        set accepted_at = now()
        where id = $1
      `,
      [invitation.id]
    );
    await client.query(
      `
        update users
        set account_status = 'active'
        where id = $1
          and account_status = 'inactive'
      `,
      [userId]
    );
    await this.createCurrentMonthIncome(client, invitation.household_id, member.id);
    this.realtime.publish(invitation.household_id, 'household.changed', member.id);

    return member;
  }

  private async ensureUserHasNoActiveHousehold(client: PoolClient, userId: string): Promise<void> {
    const activeMembership = await client.query<{ id: string }>(
      `
        select id
        from household_members
        where user_id = $1
          and is_active = true
        limit 1
      `,
      [userId]
    );

    if (activeMembership.rows[0]) {
      throw new BadRequestException('User already belongs to a household');
    }
  }

  private ensureInvitationCanBeUsed(invitation: Pick<InvitationRow, 'accepted_at' | 'expires_at'>) {
    if (invitation.accepted_at) {
      throw new BadRequestException('Invitation has already been accepted');
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      throw new BadRequestException('Invitation has expired');
    }
  }

  private async createCurrentMonthIncome(
    client: PoolClient,
    householdId: string,
    memberId: string
  ): Promise<void> {
    await client.query(
      `
        insert into monthly_incomes (
          budget_month_id,
          owner_member_id,
          amount
        )
        select id, $2, 0
        from budget_months
        where household_id = $1
          and is_current = true
        on conflict (budget_month_id, owner_member_id) do nothing
      `,
      [householdId, memberId]
    );
  }
}

interface InvitationRow {
  accepted_at: string | null;
  email: string;
  expires_at: string;
  household_id: string;
  id: string;
}

interface InvitationPreviewRow extends InvitationRow {
  household_name: string;
  invited_by_display_name: string;
}

interface InvitationUserRow {
  account_status: 'active' | 'inactive' | 'banned';
  email_verified_at: string | null;
  id: string;
  password_hash: string | null;
}

interface InvitationUserRecord {
  id: string;
}

interface MemberRow {
  household_id: string;
  id: string;
  role: 'member';
  user_id: string;
}

export interface InvitationAcceptRecord {
  householdId: string;
  invitationId: string;
  membership: {
    householdId: string;
    memberId: string;
    role: 'member';
  };
}

export interface InvitationPreviewRecord {
  email: string;
  expiresAt: string;
  householdName: string;
  invitedByDisplayName: string;
}

export interface InvitationRegistrationRecord extends InvitationAcceptRecord {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

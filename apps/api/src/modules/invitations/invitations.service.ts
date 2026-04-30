import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { UserContext } from '../../shared/request-context';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AcceptInvitationDto } from './dto/invitation.dto';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService
  ) {}

  async acceptInvitation(user: UserContext, dto: AcceptInvitationDto): Promise<InvitationAcceptRecord> {
    return this.database.transaction(async (client) => {
      const activeMembership = await client.query<{ id: string }>(
        `
          select id
          from household_members
          where user_id = $1
            and is_active = true
          limit 1
        `,
        [user.userId]
      );

      if (activeMembership.rows[0]) {
        throw new BadRequestException('User already belongs to a household');
      }

      const invitation = await this.findAcceptableInvitation(client, dto.token, user.email);

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
        [invitation.household_id, user.userId]
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
        [user.userId]
      );
      await this.createCurrentMonthIncome(client, invitation.household_id, member.id);

      const accepted = {
        householdId: invitation.household_id,
        invitationId: invitation.id,
        membership: {
          householdId: member.household_id,
          memberId: member.id,
          role: member.role
        }
      };
      this.realtime.publish(invitation.household_id, 'household.changed', member.id);

      return accepted;
    });
  }

  private async findAcceptableInvitation(
    client: PoolClient,
    token: string,
    userEmail: string
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

    if (invitation.accepted_at) {
      throw new BadRequestException('Invitation has already been accepted');
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      throw new BadRequestException('Invitation has expired');
    }

    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException('Invitation belongs to another email address');
    }

    return invitation;
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

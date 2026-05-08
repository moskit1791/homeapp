import { BadRequestException, Injectable } from '@nestjs/common';
import { AccountStatus } from '@homeapp/shared-types';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  async createLocalUser(input: CreateLocalUserInput): Promise<UserRecord> {
    const result = await this.database.query<UserRecordRow>(
      `
        insert into users (
          email,
          display_name,
          password_hash,
          email_verification_token_hash,
          email_verification_expires_at,
          account_status
        )
        values ($1, $2, $3, $4, now() + interval '24 hours', 'inactive')
        returning
          id,
          auth_provider_user_id,
          email,
          display_name,
          account_status
      `,
      [
        input.email,
        input.displayName,
        input.passwordHash,
        input.emailVerificationTokenHash
      ]
    );

    return this.mapUserRecord(result.rows[0]);
  }

  async upsertFromAuthProvider(input: UpsertUserInput): Promise<UserRecord> {
    const result = await this.database.query<UserRecordRow>(
      `
        insert into users (
          auth_provider_user_id,
          email,
          display_name,
          account_status
        )
        values ($1, $2, $3, 'inactive')
        on conflict (auth_provider_user_id) do update
        set
          email = excluded.email,
          display_name = excluded.display_name
        returning
          id,
          auth_provider_user_id,
          email,
          display_name,
          account_status
      `,
      [input.authProviderUserId, input.email, input.displayName]
    );

    return this.mapUserRecord(result.rows[0]);
  }

  async upsertGoogleUser(input: UpsertGoogleUserInput): Promise<UserRecord> {
    return this.database.transaction(async (client) => {
      const subjectResult = await client.query<UserRecordRow>(
        `
          select
            id,
            auth_provider_user_id,
            email,
            display_name,
            account_status
          from users
          where google_subject = $1
          limit 1
        `,
        [input.googleSubject]
      );
      const existingBySubject = subjectResult.rows[0];

      if (existingBySubject) {
        return this.mapUserRecord((await client.query<UserRecordRow>(
          `
            update users
            set
              email = $2,
              display_name = $3,
              email_verified_at = coalesce(email_verified_at, now()),
              account_status = case
                when account_status = 'banned' then 'banned'::account_status
                else 'active'::account_status
              end
            where id = $1
            returning
              id,
              auth_provider_user_id,
              email,
              display_name,
              account_status
          `,
          [existingBySubject.id, input.email, input.displayName]
        )).rows[0]);
      }

      const emailResult = await client.query<UserRecordRow>(
        `
          select
            id,
            auth_provider_user_id,
            email,
            display_name,
            account_status
          from users
          where email = $1
          limit 1
        `,
        [input.email]
      );
      const existingByEmail = emailResult.rows[0];

      if (existingByEmail) {
        return this.mapUserRecord((await client.query<UserRecordRow>(
          `
            update users
            set
              google_subject = $2,
              display_name = $3,
              email_verified_at = coalesce(email_verified_at, now()),
              account_status = case
                when account_status = 'banned' then 'banned'::account_status
                else 'active'::account_status
              end
            where id = $1
            returning
              id,
              auth_provider_user_id,
              email,
              display_name,
              account_status
          `,
          [existingByEmail.id, input.googleSubject, input.displayName]
        )).rows[0]);
      }

      const inserted = await client.query<UserRecordRow>(
        `
          insert into users (
            google_subject,
            email,
            display_name,
            email_verified_at,
            account_status
          )
          values ($1, $2, $3, now(), 'active')
          returning
            id,
            auth_provider_user_id,
            email,
            display_name,
            account_status
        `,
        [input.googleSubject, input.email, input.displayName]
      );

      return this.mapUserRecord(inserted.rows[0]);
    });
  }

  async findByAuthProviderUserId(authProviderUserId: string): Promise<UserRecord | null> {
    const result = await this.database.query<UserRecordRow>(
      `
        select
          id,
          auth_provider_user_id,
          email,
          display_name,
          account_status
        from users
        where auth_provider_user_id = $1
        limit 1
      `,
      [authProviderUserId]
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return this.mapUserRecord(row);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.database.query<UserRecordRow>(
      `
        select
          id,
          auth_provider_user_id,
          email,
          display_name,
          account_status
        from users
        where id = $1
        limit 1
      `,
      [id]
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return this.mapUserRecord(row);
  }

  async findByEmailForAuth(email: string): Promise<AuthUserRecord | null> {
    const result = await this.database.query<AuthUserRecordRow>(
      `
        select
          id,
          auth_provider_user_id,
          email,
          display_name,
          account_status,
          password_hash,
          email_verified_at
        from users
        where email = $1
        limit 1
      `,
      [email]
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      accountStatus: row.account_status,
      authProviderUserId: row.auth_provider_user_id,
      displayName: row.display_name,
      email: row.email,
      emailVerifiedAt: row.email_verified_at,
      id: row.id,
      passwordHash: row.password_hash
    };
  }

  async verifyEmail(email: string, tokenHash: string): Promise<boolean> {
    const result = await this.database.query(
      `
        update users
        set
          email_verified_at = now(),
          email_verification_token_hash = null,
          email_verification_expires_at = null
        where email = $1
          and email_verification_token_hash = $2
          and email_verification_expires_at > now()
      `,
      [email, tokenHash]
    );

    return Boolean(result.rowCount && result.rowCount > 0);
  }

  async setEmailVerificationToken(
    email: string,
    tokenHash: string
  ): Promise<UserEmailRecord | null> {
    const result = await this.database.query<UserEmailRecordRow>(
      `
        update users
        set
          email_verification_token_hash = $2,
          email_verification_expires_at = now() + interval '24 hours'
        where email = $1
          and email_verified_at is null
          and account_status <> 'banned'
        returning
          email,
          display_name
      `,
      [email, tokenHash]
    );

    return this.mapUserEmailRecord(result.rows[0]);
  }

  async setPasswordResetToken(email: string, tokenHash: string): Promise<UserEmailRecord | null> {
    const result = await this.database.query<UserEmailRecordRow>(
      `
        update users
        set
          password_reset_token_hash = $2,
          password_reset_expires_at = now() + interval '1 hour'
        where email = $1
        returning
          email,
          display_name
      `,
      [email, tokenHash]
    );

    return this.mapUserEmailRecord(result.rows[0]);
  }

  async resetPassword(tokenHash: string, passwordHash: string): Promise<boolean> {
    const result = await this.database.query(
      `
        update users
        set
          password_hash = $2,
          password_reset_token_hash = null,
          password_reset_expires_at = null
        where password_reset_token_hash = $1
          and password_reset_expires_at > now()
      `,
      [tokenHash, passwordHash]
    );

    return Boolean(result.rowCount && result.rowCount > 0);
  }

  async storeRefreshToken(input: StoreRefreshTokenInput): Promise<void> {
    await this.database.query(
      `
        insert into auth_refresh_tokens (
          user_id,
          token_hash,
          expires_at
        )
        values ($1, $2, $3)
      `,
      [input.userId, input.tokenHash, input.expiresAt]
    );
  }

  async consumeRefreshToken(tokenHash: string): Promise<UserRecord | null> {
    return this.database.transaction(async (client) => {
      const tokenResult = await client.query<{ user_id: string }>(
        `
          update auth_refresh_tokens
          set revoked_at = now()
          where token_hash = $1
            and revoked_at is null
            and expires_at > now()
          returning user_id
        `,
        [tokenHash]
      );
      const token = tokenResult.rows[0];

      if (!token) {
        return null;
      }

      const userResult = await client.query<UserRecordRow>(
        `
          select
            id,
            auth_provider_user_id,
            email,
            display_name,
            account_status
          from users
          where id = $1
          limit 1
        `,
        [token.user_id]
      );

      const user = userResult.rows[0];

      if (!user) {
        return null;
      }

      return this.mapUserRecord(user);
    });
  }

  async revokeRefreshTokensForUser(userId: string): Promise<void> {
    await this.database.query(
      `
        update auth_refresh_tokens
        set revoked_at = now()
        where user_id = $1
          and revoked_at is null
      `,
      [userId]
    );
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.database.transaction(async (client) => {
      const memberships = await client.query<AccountDeletionMembershipRow>(
        `
          select
            hm.id,
            hm.household_id,
            hm.role,
            (
              select count(*)::integer
              from household_members other_members
              where other_members.household_id = hm.household_id
                and other_members.is_active = true
                and other_members.id <> hm.id
            ) as other_active_members
          from household_members hm
          where hm.user_id = $1
            and hm.is_active = true
          for update
        `,
        [userId]
      );
      const blockingOwnerMembership = memberships.rows.find(
        (membership) => membership.role === 'owner' && membership.other_active_members > 0
      );

      if (blockingOwnerMembership) {
        throw new BadRequestException(
          'Owner account cannot be deleted while other household members exist'
        );
      }

      for (const membership of memberships.rows) {
        if (membership.role === 'owner') {
          await client.query(
            `
              delete from households
              where id = $1
            `,
            [membership.household_id]
          );
          continue;
        }

        await client.query(
          `
            update household_members
            set
              is_active = false,
              removed_at = now()
            where id = $1
          `,
          [membership.id]
        );
      }

      await client.query(
        `
          update auth_refresh_tokens
          set revoked_at = now()
          where user_id = $1
            and revoked_at is null
        `,
        [userId]
      );
      await client.query(
        `
          update push_tokens
          set enabled = false
          where user_id = $1
        `,
        [userId]
      );
      await client.query(
        `
          update users
          set
            auth_provider_user_id = gen_random_uuid(),
            email = $2,
            display_name = 'Usuniete konto',
            account_status = 'inactive',
            password_hash = null,
            email_verified_at = null,
            email_verification_token_hash = null,
            email_verification_expires_at = null,
            password_reset_token_hash = null,
            password_reset_expires_at = null,
            google_subject = null
          where id = $1
        `,
        [userId, `deleted-${userId}@deleted.homeapp.local`]
      );
    });
  }

  private mapUserRecord(row: UserRecordRow | undefined): UserRecord {
    if (!row) {
      throw new Error('Expected user record');
    }

    return {
      accountStatus: row.account_status,
      authProviderUserId: row.auth_provider_user_id,
      displayName: row.display_name,
      email: row.email,
      id: row.id
    };
  }

  private mapUserEmailRecord(row: UserEmailRecordRow | undefined): UserEmailRecord | null {
    if (!row) {
      return null;
    }

    return {
      displayName: row.display_name,
      email: row.email
    };
  }
}

interface UpsertUserInput {
  authProviderUserId: string;
  displayName: string;
  email: string;
}

interface UpsertGoogleUserInput {
  displayName: string;
  email: string;
  googleSubject: string;
}

interface CreateLocalUserInput {
  displayName: string;
  email: string;
  emailVerificationTokenHash: string;
  passwordHash: string;
}

interface StoreRefreshTokenInput {
  expiresAt: Date;
  tokenHash: string;
  userId: string;
}

interface AccountDeletionMembershipRow {
  household_id: string;
  id: string;
  other_active_members: number;
  role: 'member' | 'owner';
}

interface UserRecordRow {
  account_status: AccountStatus;
  auth_provider_user_id: string;
  display_name: string;
  email: string;
  id: string;
}

interface UserEmailRecordRow {
  display_name: string;
  email: string;
}

interface AuthUserRecordRow extends UserRecordRow {
  email_verified_at: string | null;
  password_hash: string | null;
}

export interface UserRecord {
  accountStatus: AccountStatus;
  authProviderUserId: string;
  displayName: string;
  email: string;
  id: string;
}

export interface AuthUserRecord extends UserRecord {
  emailVerifiedAt: string | null;
  passwordHash: string | null;
}

export interface UserEmailRecord {
  displayName: string;
  email: string;
}

import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import { InvitationsService } from './invitations.service';

function createService(queryResults: unknown[][]) {
  const client = {
    query: vi.fn().mockImplementation(() => {
      const rows = queryResults.shift() ?? [];

      return Promise.resolve({ rowCount: rows.length, rows });
    })
  };
  const database = {
    query: client.query,
    transaction: vi.fn((callback: (transactionClient: typeof client) => Promise<unknown>) =>
      callback(client)
    )
  } as unknown as DatabaseService;
  const authService = {
    issueSessionForUser: vi.fn().mockResolvedValue({
      accessToken: 'access-token',
      expiresIn: 900,
      refreshToken: 'refresh-token',
      refreshTokenExpiresAt: '2026-05-17T00:00:00.000Z'
    })
  } as unknown as AuthService;
  const realtime = {
    publish: vi.fn()
  } as unknown as RealtimeService;
  const service = new InvitationsService(authService, database, realtime);

  return { authService, client, realtime, service };
}

describe('InvitationsService invited registration', () => {
  it('creates a verified account, accepts the invitation and returns a session', async () => {
    const invitation = {
      accepted_at: null,
      email: 'guest@example.test',
      expires_at: '2099-01-01T00:00:00.000Z',
      household_id: 'household-1',
      id: 'invitation-1'
    };
    const member = {
      household_id: 'household-1',
      id: 'member-1',
      role: 'member',
      user_id: 'user-2'
    };
    const { authService, client, realtime, service } = createService([
      [invitation],
      [],
      [{ id: 'user-2' }],
      [],
      [member],
      [],
      [],
      []
    ]);

    const response = await service.completeRegistration({
      acceptedPrivacy: true,
      acceptedTerms: true,
      displayName: 'Guest',
      password: 'Password123!',
      token: 'invite-token'
    });

    expect(response).toMatchObject({
      accessToken: 'access-token',
      householdId: 'household-1',
      invitationId: 'invitation-1',
      membership: {
        householdId: 'household-1',
        memberId: 'member-1',
        role: 'member'
      }
    });
    expect(authService.issueSessionForUser).toHaveBeenCalledWith('user-2');
    expect(realtime.publish).toHaveBeenCalledWith('household-1', 'household.changed', 'member-1');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('insert into users'),
      expect.arrayContaining(['guest@example.test', 'Guest'])
    );
  });

  it('does not overwrite a verified local account password', async () => {
    const invitation = {
      accepted_at: null,
      email: 'guest@example.test',
      expires_at: '2099-01-01T00:00:00.000Z',
      household_id: 'household-1',
      id: 'invitation-1'
    };
    const existingUser = {
      account_status: 'active',
      email_verified_at: '2026-05-01T00:00:00.000Z',
      id: 'user-2',
      password_hash: 'existing-hash'
    };
    const { authService, service } = createService([
      [invitation],
      [existingUser],
      []
    ]);

    await expect(
      service.completeRegistration({
        acceptedPrivacy: true,
        acceptedTerms: true,
        displayName: 'Guest',
        password: 'Password123!',
        token: 'invite-token'
      })
    ).rejects.toThrow(ConflictException);
    expect(authService.issueSessionForUser).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service';
import { UsersService } from './users.service';

describe('UsersService session invalidation', () => {
  it('increments the session version and revokes refresh tokens after a password reset', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'user-1' }] })
        .mockResolvedValueOnce({ rowCount: 2, rows: [] })
    };
    const database = {
      transaction: vi.fn((callback) => callback(client))
    } as unknown as DatabaseService;
    const service = new UsersService(database);

    await expect(service.resetPassword('token-hash', 'password-hash')).resolves.toBe(true);
    expect(client.query.mock.calls[0]?.[0]).toContain('session_version = session_version + 1');
    expect(client.query.mock.calls[1]?.[0]).toContain('update auth_refresh_tokens');
  });

  it('only logs out the access-token generation that is still current', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
    };
    const database = {
      transaction: vi.fn((callback) => callback(client))
    } as unknown as DatabaseService;
    const service = new UsersService(database);

    await expect(service.revokeSessionsForUser('user-1', 7)).resolves.toBe(true);
    expect(client.query.mock.calls[0]?.[1]).toEqual(['user-1', 7]);
    expect(client.query.mock.calls[1]?.[0]).toContain('update auth_refresh_tokens');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { CalendarGoogleController } from './calendar-google.controller';

const household = {
  householdId: 'household-id',
  memberId: 'member-id',
  role: 'member' as const
};
const user = {
  accountStatus: 'active' as const,
  authProviderUserId: 'auth-user-id',
  email: 'user@example.com',
  userId: 'user-id'
};

describe('CalendarGoogleController encrypted synchronization', () => {
  it('allows connecting Google Calendar without checking calendar encryption', async () => {
    const calendarGoogleService = {
      createAuthorizationUrl: vi
        .fn()
        .mockReturnValue({ authorizationUrl: 'https://google.test' })
    };
    const encryptionService = {
      getModuleEncryptionState: vi.fn()
    };
    const controller = new CalendarGoogleController(
      calendarGoogleService as never,
      encryptionService as never
    );

    await expect(controller.connect(household, user)).resolves.toEqual({
      authorizationUrl: 'https://google.test'
    });
    expect(encryptionService.getModuleEncryptionState).not.toHaveBeenCalled();
  });

  it('requests a client-encryption sync plan when calendar encryption is enabled', async () => {
    const calendarGoogleService = {
      sync: vi
        .fn()
        .mockResolvedValue({ clientEncryptionRequired: true, events: [] })
    };
    const encryptionService = {
      getModuleEncryptionState: vi
        .fn()
        .mockResolvedValue({ enabled: true, keyVersion: 3 })
    };
    const controller = new CalendarGoogleController(
      calendarGoogleService as never,
      encryptionService as never
    );

    await controller.sync(household, user);

    expect(calendarGoogleService.sync).toHaveBeenCalledWith(household, user, {
      clientEncryption: true
    });
  });

  it('commits encrypted batches using the active household key version', async () => {
    const dto = { events: [], finalize: true };
    const calendarGoogleService = {
      commitEncryptedSync: vi.fn().mockResolvedValue({ importedCount: 0 })
    };
    const encryptionService = {
      getModuleEncryptionState: vi
        .fn()
        .mockResolvedValue({ enabled: true, keyVersion: 4 })
    };
    const controller = new CalendarGoogleController(
      calendarGoogleService as never,
      encryptionService as never
    );

    await controller.commitEncryptedSync(household, user, dto);

    expect(calendarGoogleService.commitEncryptedSync).toHaveBeenCalledWith(
      household,
      user,
      dto,
      4
    );
  });
});

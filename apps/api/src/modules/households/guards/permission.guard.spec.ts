import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticatedRequest } from '../../../shared/request-context';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { PermissionsService } from '../../permissions/permissions.service';
import { RequiredPermission } from '../../permissions/decorators/require-permission.decorator';

function createContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    getClass: vi.fn(),
    getHandler: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}

function createGuard(required?: RequiredPermission) {
  const permissionsService = {
    hasPermission: vi.fn()
  } as unknown as PermissionsService;
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(required)
  } as unknown as Reflector;

  return {
    guard: new PermissionGuard(permissionsService, reflector),
    permissionsService: permissionsService as unknown as {
      hasPermission: ReturnType<typeof vi.fn>;
    }
  };
}

describe('PermissionGuard', () => {
  it('allows routes without a permission requirement', async () => {
    const { guard, permissionsService } = createGuard();

    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
    expect(permissionsService.hasPermission).not.toHaveBeenCalled();
  });

  it('allows owners without querying member permissions', async () => {
    const { guard, permissionsService } = createGuard({
      action: 'delete',
      moduleKey: 'permissions'
    });

    await expect(
      guard.canActivate(
        createContext({
          householdContext: {
            householdId: 'household-1',
            memberId: 'member-owner',
            role: 'owner'
          }
        })
      )
    ).resolves.toBe(true);
    expect(permissionsService.hasPermission).not.toHaveBeenCalled();
  });

  it('allows a member when the requested permission is granted', async () => {
    const { guard, permissionsService } = createGuard({
      action: 'read',
      moduleKey: 'household_members'
    });
    permissionsService.hasPermission.mockResolvedValue(true);

    await expect(
      guard.canActivate(
        createContext({
          householdContext: {
            householdId: 'household-1',
            memberId: 'member-1',
            role: 'member'
          }
        })
      )
    ).resolves.toBe(true);
    expect(permissionsService.hasPermission).toHaveBeenCalledWith(
      'member-1',
      'household_members',
      'read'
    );
  });

  it('rejects a member when the requested permission is missing', async () => {
    const { guard, permissionsService } = createGuard({
      action: 'update',
      moduleKey: 'household_members'
    });
    permissionsService.hasPermission.mockResolvedValue(false);

    await expect(
      guard.canActivate(
        createContext({
          householdContext: {
            householdId: 'household-1',
            memberId: 'member-1',
            role: 'member'
          }
        })
      )
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects protected routes without household context', async () => {
    const { guard } = createGuard({
      action: 'read',
      moduleKey: 'household_members'
    });

    await expect(guard.canActivate(createContext({}))).rejects.toThrow(ForbiddenException);
  });
});

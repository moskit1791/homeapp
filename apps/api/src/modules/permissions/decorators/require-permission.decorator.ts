import { SetMetadata } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@homeapp/shared-types';

export const REQUIRE_PERMISSION_KEY = 'homeapp:require-permission';

export interface RequiredPermission {
  action: PermissionAction;
  moduleKey: ModuleKey;
}

export function RequirePermission(moduleKey: ModuleKey, action: PermissionAction) {
  return SetMetadata(REQUIRE_PERMISSION_KEY, { action, moduleKey } satisfies RequiredPermission);
}

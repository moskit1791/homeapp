import { useQuery } from '@tanstack/react-query';
import type { ModuleKey } from '@homeapp/shared-types';
import { getMyPermissions, queryKeys, type EffectivePermission } from '../api';
import { useSession } from '../session/session-context';

export function usePermissions() {
  const { session, status } = useSession();

  return useQuery({
    enabled: status === 'ready' && Boolean(session?.accessToken),
    queryFn: () => getMyPermissions({ accessToken: session?.accessToken }),
    queryKey: queryKeys.permissions,
    staleTime: 30_000
  });
}

export function useModulePermission(moduleKey: ModuleKey) {
  const permissionsQuery = usePermissions();
  const permission = permissionsQuery.data?.find((item) => item.moduleKey === moduleKey);

  return {
    canCreate: Boolean(permission?.canCreate),
    canDelete: Boolean(permission?.canDelete),
    canRead: Boolean(permission?.canRead),
    canUpdate: Boolean(permission?.canUpdate),
    isLoading: permissionsQuery.isLoading,
    permission,
    permissionsQuery
  };
}

export function hasModuleRead(
  permissions: EffectivePermission[] | undefined,
  moduleKeys: ModuleKey[]
): boolean {
  return moduleKeys.some(
    (moduleKey) => permissions?.find((item) => item.moduleKey === moduleKey)?.canRead
  );
}

import type { ModuleKey } from '../api';

import { useSession } from './session-context';

export function usePermission(moduleKey: ModuleKey) {
  const { permissions } = useSession();
  const permission = permissions.find((item) => item.moduleKey === moduleKey);

  return {
    canCreate: permission?.canCreate ?? false,
    canDelete: permission?.canDelete ?? false,
    canRead: permission?.canRead ?? false,
    canUpdate: permission?.canUpdate ?? false,
  };
}

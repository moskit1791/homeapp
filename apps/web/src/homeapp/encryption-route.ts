import type { EncryptableModuleKey } from '@homeapp/shared-types';

export interface EncryptionRoute {
  label: string;
  modules: EncryptableModuleKey[];
}

const encryptionRoutes: Record<string, EncryptionRoute> = {
  '/kalendarz': { label: 'Kalendarz', modules: ['calendar'] },
  '/finanse': { label: 'Finanse', modules: ['finances'] },
  '/zakupy': { label: 'Zakupy', modules: ['shopping'] },
  '/spizarnia': { label: 'Spiżarnia', modules: ['shopping'] },
  '/posilki': { label: 'Plan posiłków', modules: ['meal_planner'] },
  '/zadania': { label: 'Zadania', modules: ['notes', 'todo'] },
  '/dom': {
    label: 'Dom',
    modules: ['cleaning', 'annual_costs', 'data_entries', 'attachments'],
  },
};

export function encryptionRouteForPath(pathname: string): EncryptionRoute | null {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  return encryptionRoutes[normalizedPath] ?? null;
}

export function routeNeedsEncryptionUnlock(
  pathname: string,
  enabledModules: EncryptableModuleKey[]
): boolean {
  const route = encryptionRouteForPath(pathname);
  return Boolean(route?.modules.some((module) => enabledModules.includes(module)));
}

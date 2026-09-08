import type { PropsWithChildren } from 'react';
import type { EncryptableModuleKey } from '@homeapp/shared-types';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, useEffect, useContext, createContext } from 'react';

import { useSession } from './session-context';
import { configureRuntimeEncryption } from '../encryption-runtime';
import {
  openJson,
  sealJson,
  keyToHex,
  openBytes,
  randomKey,
  sealBytes,
  randomSalt,
  keyFromHex,
  parseRecoveryCode,
  formatRecoveryCode,
  derivePassphraseKey,
} from '../encryption-crypto';
import {
  type EncryptionMigrationItem,
  exportHouseholdEncryptionData,
  getHouseholdEncryptionSettings,
  type HouseholdEncryptionSettings,
  removeHouseholdEncryptionSettings,
  updateHouseholdEncryptionSettings,
} from '../api';

type LockState = 'loading' | 'not-configured' | 'locked' | 'unlocked';
interface EncryptionContextValue {
  lockState: LockState;
  settings: HouseholdEncryptionSettings | null;
  setup: (passphrase: string, modules: EncryptableModuleKey[]) => Promise<string>;
  unlock: (passphrase: string) => Promise<void>;
  recover: (code: string, passphrase: string) => Promise<string>;
  lock: () => void;
  saveEnabledModules: (modules: EncryptableModuleKey[]) => Promise<void>;
  removeEncryption: () => Promise<void>;
}

const EncryptionContext = createContext<EncryptionContextValue | null>(null);

export function EncryptionProvider({ children }: PropsWithChildren) {
  const { accessToken, status } = useSession();
  const queryClient = useQueryClient();
  const [dataKey, setDataKey] = useState<Uint8Array | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const settingsQuery = useQuery({
    queryKey: ['encryption', 'household'],
    queryFn: () => getHouseholdEncryptionSettings({ accessToken }),
    enabled: status === 'ready' && Boolean(accessToken),
  });
  const settings = settingsQuery.data ?? null;
  const storageKey = settings ? `homeapp.web.e2ee.v1.${settings.householdId}` : null;

  useEffect(() => {
    if (!settings || !storageKey || !settings.configured || !settings.keyVersion) {
      setDataKey(null);
      setCheckedStorage(true);
      return;
    }
    try {
      const raw = sessionStorage.getItem(storageKey);
      const stored = raw ? JSON.parse(raw) as { keyHex?: string; keyVersion?: number } : null;
      setDataKey(stored?.keyHex && stored.keyVersion === settings.keyVersion ? keyFromHex(stored.keyHex) : null);
    } catch { setDataKey(null); }
    setCheckedStorage(true);
  }, [settings, storageKey]);

  useEffect(() => {
    configureRuntimeEncryption({ dataKey, enabledModules: settings?.enabledModules ?? [], keyVersion: settings?.keyVersion ?? null });
    if (dataKey) void queryClient.invalidateQueries({ type: 'active' });
  }, [dataKey, queryClient, settings?.enabledModules, settings?.keyVersion]);

  const value = useMemo<EncryptionContextValue>(() => {
    const requireSettings = () => {
      if (!settings?.configured || !settings.kdfSalt || !settings.keyVersion || !settings.recoveryWrappedKey || !settings.wrappedKey) throw new Error('Szyfrowanie domu nie zostało skonfigurowane.');
      return settings as HouseholdEncryptionSettings & { kdfSalt: string; keyVersion: number; recoveryWrappedKey: string; wrappedKey: string };
    };
    const requireKey = () => {
      if (!dataKey) throw new Error('Najpierw odblokuj szyfrowanie.');
      return dataKey;
    };
    const persist = (key: Uint8Array, version: number) => {
      if (!storageKey) throw new Error('Brak aktywnego domu.');
      sessionStorage.setItem(storageKey, JSON.stringify({ keyHex: keyToHex(key), keyVersion: version }));
      setDataKey(key);
    };
    const credentials = async (key: Uint8Array, version: number, passphrase: string) => {
      const recoveryKey = await randomKey();
      const salt = await randomSalt();
      const kdfSalt = keyToHex(salt);
      const passphraseKey = await derivePassphraseKey(passphrase, kdfSalt);
      return {
        kdfSalt,
        recoveryCode: formatRecoveryCode(recoveryKey),
        wrappedKey: await sealBytes(key, passphraseKey, `homeapp:household-key:${version}`),
        recoveryWrappedKey: await sealBytes(key, recoveryKey, `homeapp:recovery-key:${version}`),
      };
    };
    const migrations = async (currentModules: EncryptableModuleKey[], nextModules: EncryptableModuleKey[], sourceKey: Uint8Array, targetKey: Uint8Array, targetVersion: number, rotate = false) => {
      const allModules = [...new Set([...currentModules, ...nextModules])];
      const result: EncryptionMigrationItem[] = [];
      for (const module of allModules) {
        if (!rotate && currentModules.includes(module) === nextModules.includes(module)) continue;
        const records = await exportHouseholdEncryptionData(module, { accessToken });
        for (const record of records) {
          if (nextModules.includes(module)) {
            const plaintext = record.encryptedPayload ? openJson<Record<string, unknown>>(record.encryptedPayload, sourceKey, `homeapp:${module}:${record.entity}`) : record.plaintextPayload;
            if (plaintext) result.push({ entity: record.entity, id: record.id, sourceRevision: record.sourceRevision, encryptionVersion: targetVersion, encryptedPayload: await sealJson(plaintext, targetKey, `homeapp:${module}:${record.entity}`) });
          } else if (record.encryptedPayload) {
            result.push({ entity: record.entity, id: record.id, sourceRevision: record.sourceRevision, encryptionVersion: targetVersion, plaintextPayload: openJson(record.encryptedPayload, sourceKey, `homeapp:${module}:${record.entity}`) });
          }
        }
      }
      return result;
    };
    const cacheSettings = (next: HouseholdEncryptionSettings) => queryClient.setQueryData(['encryption', 'household'], next);

    return {
      settings,
      lockState: !settings || settingsQuery.isLoading || !checkedStorage ? 'loading' : !settings.configured ? 'not-configured' : dataKey ? 'unlocked' : 'locked',
      lock: () => { if (storageKey) sessionStorage.removeItem(storageKey); setDataKey(null); },
      unlock: async (passphrase) => {
        const current = requireSettings();
        const wrappingKey = await derivePassphraseKey(passphrase, current.kdfSalt);
        persist(openBytes(current.wrappedKey, wrappingKey, `homeapp:household-key:${current.keyVersion}`), current.keyVersion);
      },
      setup: async (passphrase, modules) => {
        if (!settings?.canManage) throw new Error('Tylko właściciel może włączyć szyfrowanie.');
        const key = await randomKey();
        const version = 1;
        const nextCredentials = await credentials(key, version, passphrase);
        const migrationItems = await migrations(settings.enabledModules, modules, key, key, version);
        const next = await updateHouseholdEncryptionSettings({ enabledModules: modules, expectedUpdatedAt: settings.updatedAt, keyVersion: version, migrationItems, kdfSalt: nextCredentials.kdfSalt, wrappedKey: nextCredentials.wrappedKey, recoveryWrappedKey: nextCredentials.recoveryWrappedKey }, { accessToken });
        persist(key, version); cacheSettings(next); return nextCredentials.recoveryCode;
      },
      recover: async (code, passphrase) => {
        const current = requireSettings();
        const oldKey = openBytes(current.recoveryWrappedKey, parseRecoveryCode(code), `homeapp:recovery-key:${current.keyVersion}`);
        const key = await randomKey();
        const version = current.keyVersion + 1;
        const nextCredentials = await credentials(key, version, passphrase);
        const migrationItems = await migrations(settings!.enabledModules, settings!.enabledModules, oldKey, key, version, true);
        const next = await updateHouseholdEncryptionSettings({ enabledModules: settings!.enabledModules, expectedUpdatedAt: settings!.updatedAt, keyVersion: version, migrationItems, kdfSalt: nextCredentials.kdfSalt, wrappedKey: nextCredentials.wrappedKey, recoveryWrappedKey: nextCredentials.recoveryWrappedKey }, { accessToken });
        persist(key, version); cacheSettings(next); return nextCredentials.recoveryCode;
      },
      saveEnabledModules: async (modules) => {
        const current = requireSettings(); const key = requireKey();
        const migrationItems = await migrations(settings!.enabledModules, modules, key, key, current.keyVersion);
        const next = await updateHouseholdEncryptionSettings({ enabledModules: modules, expectedUpdatedAt: settings!.updatedAt, keyVersion: current.keyVersion, migrationItems, kdfSalt: current.kdfSalt, wrappedKey: current.wrappedKey, recoveryWrappedKey: current.recoveryWrappedKey }, { accessToken });
        cacheSettings(next);
      },
      removeEncryption: async () => {
        const current = requireSettings(); const key = requireKey();
        const migrationItems = await migrations(settings!.enabledModules, [], key, key, current.keyVersion);
        const next = await removeHouseholdEncryptionSettings({ expectedUpdatedAt: settings!.updatedAt ?? '', keyVersion: current.keyVersion, migrationItems }, { accessToken });
        if (storageKey) sessionStorage.removeItem(storageKey); setDataKey(null); cacheSettings(next);
      },
    };
  }, [accessToken, checkedStorage, dataKey, queryClient, settings, settingsQuery.isLoading, storageKey]);

  return <EncryptionContext.Provider value={value}>{children}</EncryptionContext.Provider>;
}

export function useEncryption() {
  const context = useContext(EncryptionContext);
  if (!context) throw new Error('useEncryption wymaga EncryptionProvider.');
  return context;
}

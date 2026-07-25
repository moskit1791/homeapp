import {
  ENCRYPTABLE_MODULE_KEYS,
  type EncryptableModuleKey,
} from "@homeapp/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getHouseholdEncryptionSettings,
  exportHouseholdEncryptionData,
  queryKeys,
  removeHouseholdEncryptionSettings,
  updateHouseholdEncryptionSettings,
  type EncryptionMigrationItem,
  type HouseholdEncryptionSettings,
} from "../api";
import { useSession } from "../session/session-context";
import {
  derivePassphraseKey,
  formatRecoveryCode,
  keyFromHex,
  keyToHex,
  openBytes,
  openJson,
  parseRecoveryCode,
  randomKey,
  randomSalt,
  sealBytes,
  sealJson,
} from "./crypto";
import { configureRuntimeEncryption } from "./runtime-transport";

const localKeyStoragePrefix = "homeapp.household-encryption-key.v1";
const localBiometricKeyStoragePrefix =
  "homeapp.household-encryption-biometric-key.v1";
const localBiometricPreferencePrefix =
  "homeapp.household-encryption-biometric-enabled.v1";

const biometricSecureStoreOptions: SecureStore.SecureStoreOptions = {
  authenticationPrompt: "Odblokuj zaszyfrowane dane HomeApp",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: true,
};

type EncryptionLockState = "loading" | "not-configured" | "locked" | "unlocked";

interface EncryptionContextValue {
  biometricsAvailable: boolean;
  biometricsEnabled: boolean;
  clearLocalKey: () => Promise<void>;
  decryptPayload: <T>(
    module: EncryptableModuleKey,
    entity: string,
    payload: string,
  ) => T;
  encryptPayload: <T>(
    module: EncryptableModuleKey,
    entity: string,
    payload: T,
  ) => Promise<string>;
  isModuleEnabled: (module: EncryptableModuleKey) => boolean;
  localKeyStored: boolean;
  lockState: EncryptionLockState;
  recover: (recoveryCode: string, newPassphrase: string) => Promise<string>;
  removeEncryption: () => Promise<void>;
  rotateCredentials: (newPassphrase: string) => Promise<string>;
  saveEnabledModules: (modules: EncryptableModuleKey[]) => Promise<void>;
  setBiometricProtection: (enabled: boolean) => Promise<void>;
  settings: HouseholdEncryptionSettings | null;
  setup: (
    passphrase: string,
    modules: EncryptableModuleKey[],
  ) => Promise<string>;
  unlock: (passphrase: string) => Promise<void>;
  unlockWithBiometrics: () => Promise<void>;
}

const EncryptionContext = createContext<EncryptionContextValue | undefined>(
  undefined,
);

export function EncryptionProvider({ children }: PropsWithChildren) {
  const { session, status } = useSession();
  const queryClient = useQueryClient();
  const [dataKey, setDataKey] = useState<Uint8Array | null>(null);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [localKeyStored, setLocalKeyStored] = useState(false);
  const [localKeyChecked, setLocalKeyChecked] = useState(false);
  const accessToken = session?.accessToken;
  const settingsQuery = useQuery({
    enabled: status === "ready" && Boolean(accessToken),
    queryFn: () => getHouseholdEncryptionSettings({ accessToken }),
    queryKey: queryKeys.encryption,
  });
  const settings = accessToken ? (settingsQuery.data ?? null) : null;
  const localKeyStorageKey = settings
    ? `${localKeyStoragePrefix}.${settings.householdId}`
    : null;
  const localBiometricKeyStorageKey = settings
    ? `${localBiometricKeyStoragePrefix}.${settings.householdId}`
    : null;
  const localBiometricPreferenceKey = settings
    ? `${localBiometricPreferencePrefix}.${settings.householdId}`
    : null;

  useEffect(() => {
    configureRuntimeEncryption({
      dataKey,
      enabledModules: settings?.enabledModules ?? [],
      keyVersion: settings?.keyVersion ?? null,
    });
  }, [dataKey, settings?.enabledModules, settings?.keyVersion]);

  useEffect(() => {
    if (dataKey) {
      void queryClient.invalidateQueries({ type: "active" });
    }
  }, [dataKey, queryClient]);

  useEffect(() => {
    let active = true;

    if (
      !settings?.configured ||
      !settings.keyVersion ||
      !localKeyStorageKey ||
      !localBiometricKeyStorageKey ||
      !localBiometricPreferenceKey
    ) {
      if (
        settings &&
        localKeyStorageKey &&
        localBiometricKeyStorageKey &&
        localBiometricPreferenceKey
      ) {
        void Promise.all([
          SecureStore.deleteItemAsync(localKeyStorageKey),
          SecureStore.deleteItemAsync(localBiometricKeyStorageKey),
          SecureStore.deleteItemAsync(localBiometricPreferenceKey),
        ]).catch(() => undefined);
      }
      setDataKey(null);
      setBiometricsAvailable(false);
      setBiometricsEnabled(false);
      setLocalKeyStored(false);
      setLocalKeyChecked(true);
      return undefined;
    }

    setLocalKeyChecked(false);
    setLocalKeyStored(false);
    setDataKey(null);
    setBiometricsAvailable(SecureStore.canUseBiometricAuthentication());
    void SecureStore.getItemAsync(localBiometricPreferenceKey)
      .then(async (preference) => {
        const shouldUseBiometrics = preference === "true";
        setBiometricsEnabled(shouldUseBiometrics);

        if (shouldUseBiometrics) {
          setLocalKeyStored(true);
          return SecureStore.getItemAsync(
            localBiometricKeyStorageKey,
            biometricSecureStoreOptions,
          );
        }

        const raw = await SecureStore.getItemAsync(localKeyStorageKey);
        setLocalKeyStored(Boolean(raw));
        return raw;
      })
      .then((raw) => {
        if (!active) {
          return;
        }

        if (!raw) {
          setLocalKeyStored(false);
          return;
        }

        const stored = JSON.parse(raw) as {
          keyHex?: string;
          keyVersion?: number;
        };

        if (stored.keyHex && stored.keyVersion === settings.keyVersion) {
          setDataKey(keyFromHex(stored.keyHex));
        }
      })
      .catch(() => {
        if (active) {
          setDataKey(null);
        }
      })
      .finally(() => {
        if (active) {
          setLocalKeyChecked(true);
        }
      });

    return () => {
      active = false;
    };
  }, [
    localBiometricKeyStorageKey,
    localBiometricPreferenceKey,
    localKeyStorageKey,
    settings?.configured,
    settings?.keyVersion,
  ]);

  const value = useMemo<EncryptionContextValue>(() => {
    const requireSettings = (): {
      kdfSalt: string;
      keyVersion: number;
      recoveryWrappedKey: string;
      wrappedKey: string;
    } => {
      if (
        !settings?.configured ||
        !settings.kdfSalt ||
        !settings.keyVersion ||
        !settings.recoveryWrappedKey ||
        !settings.wrappedKey
      ) {
        throw new Error("Szyfrowanie domu nie zostało skonfigurowane.");
      }

      return {
        kdfSalt: settings.kdfSalt,
        keyVersion: settings.keyVersion,
        recoveryWrappedKey: settings.recoveryWrappedKey,
        wrappedKey: settings.wrappedKey,
      };
    };
    const requireDataKey = () => {
      if (!dataKey) {
        throw new Error("Najpierw odblokuj szyfrowanie w ustawieniach.");
      }

      return dataKey;
    };
    const serializedKey = (key: Uint8Array, keyVersion: number) =>
      JSON.stringify({ keyHex: keyToHex(key), keyVersion });
    const persistKey = async (
      key: Uint8Array,
      keyVersion: number,
      protectWithBiometrics = biometricsEnabled,
    ) => {
      if (
        !localKeyStorageKey ||
        !localBiometricKeyStorageKey ||
        !localBiometricPreferenceKey
      ) {
        throw new Error("Brak aktywnego domu dla klucza szyfrowania.");
      }

      if (protectWithBiometrics) {
        await SecureStore.setItemAsync(
          localBiometricKeyStorageKey,
          serializedKey(key, keyVersion),
          biometricSecureStoreOptions,
        );
        await SecureStore.setItemAsync(localBiometricPreferenceKey, "true");
        await SecureStore.deleteItemAsync(localKeyStorageKey);
        setBiometricsEnabled(true);
      } else {
        await SecureStore.setItemAsync(
          localKeyStorageKey,
          serializedKey(key, keyVersion),
          {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          },
        );
        await SecureStore.setItemAsync(localBiometricPreferenceKey, "false");
        setBiometricsEnabled(false);
      }

      configureRuntimeEncryption({
        dataKey: key,
        enabledModules: settings?.enabledModules ?? [],
        keyVersion,
      });
      setDataKey(key);
      setLocalKeyStored(true);
    };
    const readBiometricKey = async () => {
      if (!localBiometricKeyStorageKey || !settings?.keyVersion) {
        throw new Error("Brak lokalnego klucza biometrycznego dla tego domu.");
      }

      const raw = await SecureStore.getItemAsync(
        localBiometricKeyStorageKey,
        biometricSecureStoreOptions,
      );

      if (!raw) {
        throw new Error(
          "Nie udało się odczytać klucza biometrycznego. Użyj hasła szyfrowania lub kodu odzyskiwania.",
        );
      }

      const stored = JSON.parse(raw) as {
        keyHex?: string;
        keyVersion?: number;
      };

      if (!stored.keyHex || stored.keyVersion !== settings.keyVersion) {
        throw new Error(
          "Lokalny klucz biometryczny jest nieaktualny. Odblokuj dane hasłem.",
        );
      }

      const key = keyFromHex(stored.keyHex);
      configureRuntimeEncryption({
        dataKey: key,
        enabledModules: settings?.enabledModules ?? [],
        keyVersion: settings.keyVersion,
      });
      setDataKey(key);
    };
    const updateCachedSettings = (next: HouseholdEncryptionSettings) => {
      queryClient.setQueryData(queryKeys.encryption, next);
    };
    const createKeyCredentials = async (
      key: Uint8Array,
      keyVersion: number,
      passphrase: string,
    ) => {
      const [recoveryKey, salt] = await Promise.all([
        randomKey(),
        randomSalt(),
      ]);
      const saltHex = keyToHex(salt);
      const passphraseKey = await derivePassphraseKey(passphrase, saltHex);
      const [wrappedKey, recoveryWrappedKey] = await Promise.all([
        sealBytes(key, passphraseKey, `homeapp:household-key:${keyVersion}`),
        sealBytes(key, recoveryKey, `homeapp:recovery-key:${keyVersion}`),
      ]);

      return {
        kdfSalt: saltHex,
        recoveryCode: formatRecoveryCode(recoveryKey),
        recoveryWrappedKey,
        wrappedKey,
      };
    };
    const buildMigrationItems = async (
      currentModules: EncryptableModuleKey[],
      nextModules: EncryptableModuleKey[],
      sourceKey: Uint8Array,
      targetKey: Uint8Array,
      targetKeyVersion: number,
      rotateEnabledModules = false,
    ): Promise<EncryptionMigrationItem[]> => {
      const changedModules = ENCRYPTABLE_MODULE_KEYS.filter(
        (module) =>
          currentModules.includes(module) !== nextModules.includes(module) ||
          (rotateEnabledModules && nextModules.includes(module)),
      );
      const migrations: EncryptionMigrationItem[] = [];

      for (const module of changedModules) {
        const records = await exportHouseholdEncryptionData(module, {
          accessToken,
        });
        const wasEnabled = currentModules.includes(module);
        const enabling = nextModules.includes(module);

        for (const record of records) {
          if (enabling) {
            const plaintextPayload = record.encryptedPayload
              ? openJson<Record<string, unknown>>(
                  record.encryptedPayload,
                  sourceKey,
                  `homeapp:${module}:${record.entity}`,
                )
              : record.plaintextPayload;

            if (!plaintextPayload) {
              continue;
            }

            migrations.push({
              encryptedPayload: await sealJson(
                plaintextPayload,
                targetKey,
                `homeapp:${module}:${record.entity}`,
              ),
              encryptionVersion: targetKeyVersion,
              entity: record.entity,
              id: record.id,
              sourceRevision: record.sourceRevision,
            });
            continue;
          }

          if (!wasEnabled || !record.encryptedPayload) {
            continue;
          }

          migrations.push({
            encryptionVersion: targetKeyVersion,
            entity: record.entity,
            id: record.id,
            plaintextPayload: openJson<Record<string, unknown>>(
              record.encryptedPayload,
              sourceKey,
              `homeapp:${module}:${record.entity}`,
            ),
            sourceRevision: record.sourceRevision,
          });
        }
      }

      return migrations;
    };

    return {
      biometricsAvailable,
      biometricsEnabled,
      clearLocalKey: async () => {
        if (localKeyStorageKey) {
          await SecureStore.deleteItemAsync(localKeyStorageKey);
        }
        if (localBiometricKeyStorageKey) {
          await SecureStore.deleteItemAsync(
            localBiometricKeyStorageKey,
            biometricSecureStoreOptions,
          ).catch(() => undefined);
        }
        if (localBiometricPreferenceKey) {
          await SecureStore.deleteItemAsync(localBiometricPreferenceKey);
        }
        setBiometricsEnabled(false);
        setLocalKeyStored(false);
        setDataKey(null);
      },
      decryptPayload: <T,>(
        module: EncryptableModuleKey,
        entity: string,
        payload: string,
      ): T =>
        openJson<T>(payload, requireDataKey(), `homeapp:${module}:${entity}`),
      encryptPayload: <T,>(
        module: EncryptableModuleKey,
        entity: string,
        payload: T,
      ): Promise<string> =>
        sealJson(payload, requireDataKey(), `homeapp:${module}:${entity}`),
      isModuleEnabled: (module) =>
        settings?.enabledModules.includes(module) ?? false,
      localKeyStored,
      lockState:
        !settings || settingsQuery.isLoading || !localKeyChecked
          ? "loading"
          : !settings.configured
            ? "not-configured"
            : dataKey
              ? "unlocked"
              : "locked",
      recover: async (recoveryCode, newPassphrase) => {
        const current = requireSettings();
        const recoveryKey = parseRecoveryCode(recoveryCode);
        const oldKey = openBytes(
          current.recoveryWrappedKey,
          recoveryKey,
          `homeapp:recovery-key:${current.keyVersion}`,
        );
        const key = await randomKey();
        const keyVersion = current.keyVersion + 1;
        const credentials = await createKeyCredentials(
          key,
          keyVersion,
          newPassphrase,
        );
        const enabledModules = settings?.enabledModules ?? [];
        const migrationItems = await buildMigrationItems(
          enabledModules,
          enabledModules,
          oldKey,
          key,
          keyVersion,
          true,
        );
        const next = await updateHouseholdEncryptionSettings(
          {
            enabledModules,
            expectedUpdatedAt: settings?.updatedAt,
            kdfSalt: credentials.kdfSalt,
            keyVersion,
            migrationItems,
            recoveryWrappedKey: credentials.recoveryWrappedKey,
            wrappedKey: credentials.wrappedKey,
          },
          { accessToken },
        );
        await persistKey(key, keyVersion);
        updateCachedSettings(next);

        return credentials.recoveryCode;
      },
      removeEncryption: async () => {
        if (!settings?.canManage) {
          throw new Error(
            "Tylko właściciel domu może całkowicie wyłączyć szyfrowanie.",
          );
        }

        const current = requireSettings();
        const sourceKey =
          settings.enabledModules.length > 0 ? requireDataKey() : null;
        const migrationItems = sourceKey
          ? await buildMigrationItems(
              settings.enabledModules,
              [],
              sourceKey,
              sourceKey,
              current.keyVersion,
            )
          : [];
        const next = await removeHouseholdEncryptionSettings(
          {
            expectedUpdatedAt: settings.updatedAt ?? "",
            keyVersion: current.keyVersion,
            migrationItems,
          },
          { accessToken },
        );
        const cleanupResults = await Promise.allSettled(
          [
            localKeyStorageKey,
            localBiometricKeyStorageKey,
            localBiometricPreferenceKey,
          ]
            .filter((key): key is string => Boolean(key))
            .map((key) => SecureStore.deleteItemAsync(key)),
        );

        configureRuntimeEncryption({
          dataKey: null,
          enabledModules: [],
          keyVersion: null,
        });
        setDataKey(null);
        setBiometricsEnabled(false);
        setLocalKeyStored(false);
        updateCachedSettings(next);
        void queryClient.invalidateQueries({ type: "active" });

        if (cleanupResults.some((result) => result.status === "rejected")) {
          throw new Error(
            "Szyfrowanie wyłączono i dane odszyfrowano, ale nie udało się usunąć lokalnej kopii klucza. Uruchom ponownie aplikację, aby ponowić czyszczenie.",
          );
        }
      },
      rotateCredentials: async (newPassphrase) => {
        if (!settings?.canManage) {
          throw new Error(
            "Tylko właściciel domu może zmienić dane odzyskiwania.",
          );
        }

        const current = requireSettings();
        const oldKey = requireDataKey();
        const key = await randomKey();
        const keyVersion = current.keyVersion + 1;
        const credentials = await createKeyCredentials(
          key,
          keyVersion,
          newPassphrase,
        );
        const migrationItems = await buildMigrationItems(
          settings.enabledModules,
          settings.enabledModules,
          oldKey,
          key,
          keyVersion,
          true,
        );
        const next = await updateHouseholdEncryptionSettings(
          {
            enabledModules: settings.enabledModules,
            expectedUpdatedAt: settings.updatedAt,
            kdfSalt: credentials.kdfSalt,
            keyVersion,
            migrationItems,
            recoveryWrappedKey: credentials.recoveryWrappedKey,
            wrappedKey: credentials.wrappedKey,
          },
          { accessToken },
        );
        await persistKey(key, keyVersion);
        updateCachedSettings(next);

        return credentials.recoveryCode;
      },
      saveEnabledModules: async (modules) => {
        const current = requireSettings();
        const key = requireDataKey();
        const migrationItems = await buildMigrationItems(
          settings?.enabledModules ?? [],
          modules,
          key,
          key,
          current.keyVersion,
        );
        const next = await updateHouseholdEncryptionSettings(
          {
            enabledModules: modules,
            expectedUpdatedAt: settings?.updatedAt,
            kdfSalt: current.kdfSalt,
            keyVersion: current.keyVersion,
            migrationItems,
            recoveryWrappedKey: current.recoveryWrappedKey,
            wrappedKey: current.wrappedKey,
          },
          { accessToken },
        );
        updateCachedSettings(next);
      },
      setBiometricProtection: async (enabled) => {
        const key = requireDataKey();
        const current = requireSettings();

        if (enabled && !biometricsAvailable) {
          throw new Error(
            "Na tym urządzeniu nie skonfigurowano obsługiwanej biometrii.",
          );
        }

        await persistKey(key, current.keyVersion, enabled);

        if (!enabled && localBiometricKeyStorageKey) {
          await SecureStore.deleteItemAsync(
            localBiometricKeyStorageKey,
            biometricSecureStoreOptions,
          ).catch(() => undefined);
        }
      },
      settings,
      setup: async (passphrase, modules) => {
        if (!settings?.canManage) {
          throw new Error("Tylko właściciel domu może włączyć szyfrowanie.");
        }

        const keyVersion = 1;
        const key = await randomKey();
        const credentials = await createKeyCredentials(
          key,
          keyVersion,
          passphrase,
        );
        const migrationItems = await buildMigrationItems(
          settings.enabledModules,
          modules,
          key,
          key,
          keyVersion,
        );
        const next = await updateHouseholdEncryptionSettings(
          {
            enabledModules: modules,
            expectedUpdatedAt: settings.updatedAt,
            kdfSalt: credentials.kdfSalt,
            keyVersion,
            migrationItems,
            recoveryWrappedKey: credentials.recoveryWrappedKey,
            wrappedKey: credentials.wrappedKey,
          },
          { accessToken },
        );
        await persistKey(key, keyVersion);
        updateCachedSettings(next);

        return credentials.recoveryCode;
      },
      unlock: async (passphrase) => {
        const current = requireSettings();
        const passphraseKey = await derivePassphraseKey(
          passphrase,
          current.kdfSalt,
        );
        const key = openBytes(
          current.wrappedKey,
          passphraseKey,
          `homeapp:household-key:${current.keyVersion}`,
        );
        await persistKey(key, current.keyVersion);
      },
      unlockWithBiometrics: readBiometricKey,
    };
  }, [
    accessToken,
    biometricsAvailable,
    biometricsEnabled,
    dataKey,
    localKeyChecked,
    localBiometricKeyStorageKey,
    localBiometricPreferenceKey,
    localKeyStorageKey,
    localKeyStored,
    queryClient,
    settings,
    settingsQuery.isLoading,
  ]);

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption() {
  const context = useContext(EncryptionContext);

  if (!context) {
    throw new Error("useEncryption must be used inside EncryptionProvider");
  }

  return context;
}

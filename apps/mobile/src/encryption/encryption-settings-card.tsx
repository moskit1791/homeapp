import type { EncryptableModuleKey } from "@homeapp/shared-types";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useAppTheme, type AppPalette } from "../theme/use-app-theme";
import { ActionButton, InlineAlert } from "../ui";
import { useEncryption } from "./encryption-context";

const moduleOptions: Array<{
  description: string;
  keys: EncryptableModuleKey[];
  label: string;
}> = [
  {
    description:
      "Kwoty, nazwy, opisy, pożyczki, oszczędności i historia wydatków.",
    keys: ["finances"],
    label: "Finanse",
  },
  {
    description:
      "Tytuły, notatki i lokalizacje. Daty pozostają technicznie widoczne dla przypomnień.",
    keys: ["calendar"],
    label: "Kalendarz",
  },
  {
    description: "Posiłki, pomysły, produkty, ilości i zawartość spiżarni.",
    keys: ["meal_planner", "shopping"],
    label: "Jedzenie",
  },
  {
    description: "Tytuły i opisy notatek oraz zadań do wykonania.",
    keys: ["todo", "notes"],
    label: "Zadania",
  },
  {
    description:
      "Sprzątanie, koszty roczne, dane domowe oraz opisy załączników.",
    keys: ["cleaning", "annual_costs", "data_entries", "attachments"],
    label: "Dom",
  },
];

interface EncryptionSettingsCardProps {
  mode?: "configuration" | "summary";
  onOpenConfiguration?: () => void;
}

export function EncryptionSettingsCard({
  mode = "summary",
  onOpenConfiguration,
}: EncryptionSettingsCardProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const {
    biometricsAvailable,
    biometricsEnabled,
    clearLocalKey,
    localKeyStored,
    lockState,
    recover,
    removeEncryption,
    rotateCredentials,
    saveEnabledModules,
    setBiometricProtection,
    settings,
    setup,
    unlock,
    unlockWithBiometrics,
  } = useEncryption();
  const [draftModules, setDraftModules] = useState<EncryptableModuleKey[]>([]);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseConfirmation, setPassphraseConfirmation] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setDraftModules(settings?.enabledModules ?? []);
  }, [settings?.enabledModules]);

  function toggleModuleGroup(modules: EncryptableModuleKey[]) {
    setDraftModules((current) => {
      const enabled = modules.every((module) => current.includes(module));

      return enabled
        ? current.filter((module) => !modules.includes(module))
        : Array.from(new Set([...current, ...modules]));
    });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await action();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Nie udało się zapisać ustawień szyfrowania.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSetup() {
    await run(async () => {
      if (passphrase.length < 12) {
        throw new Error("Hasło szyfrowania musi mieć co najmniej 12 znaków.");
      }

      if (passphrase !== passphraseConfirmation) {
        throw new Error("Hasła szyfrowania nie są takie same.");
      }

      if (draftModules.length === 0) {
        throw new Error("Wybierz co najmniej jeden moduł do zaszyfrowania.");
      }

      const code = await setup(passphrase, draftModules);
      setGeneratedRecoveryCode(code);
      setPassphrase("");
      setPassphraseConfirmation("");
      setNotice(
        "Szyfrowanie zostało skonfigurowane. Zapisz kod odzyskiwania poza telefonem.",
      );
    });
  }

  async function handleUnlock() {
    await run(async () => {
      await unlock(passphrase);
      setPassphrase("");
      setNotice("Klucz został zapisany bezpiecznie na tym urządzeniu.");
    });
  }

  async function handleRecovery() {
    await run(async () => {
      if (!settings?.canManage) {
        throw new Error("Odzyskanie i zmiana hasła wymaga właściciela domu.");
      }

      if (newPassphrase.length < 12) {
        throw new Error(
          "Nowe hasło szyfrowania musi mieć co najmniej 12 znaków.",
        );
      }

      const code = await recover(recoveryCode, newPassphrase);
      setGeneratedRecoveryCode(code);
      setRecoveryCode("");
      setNewPassphrase("");
      setNotice(
        "Dostęp odzyskany. Klucz danych został zmieniony, a poprzedni kod i klucze innych urządzeń unieważniono.",
      );
    });
  }

  async function handleRotateCredentials() {
    await run(async () => {
      if (newPassphrase.length < 12) {
        throw new Error(
          "Nowe hasło szyfrowania musi mieć co najmniej 12 znaków.",
        );
      }

      if (newPassphrase !== passphraseConfirmation) {
        throw new Error("Nowe hasła szyfrowania nie są takie same.");
      }

      const code = await rotateCredentials(newPassphrase);
      setGeneratedRecoveryCode(code);
      setNewPassphrase("");
      setPassphraseConfirmation("");
      setNotice(
        "Hasło i klucz danych zmienione. Inne urządzenia wymagają nowego hasła, a poprzedni kod odzyskiwania jest nieważny.",
      );
    });
  }

  function handleRemoveEncryption() {
    Alert.alert(
      "Wyłączyć szyfrowanie całkowicie?",
      "Wszystkie chronione dane zostaną odszyfrowane i zapisane w bazie jako zwykły tekst. Konfiguracja oraz zaszyfrowane kopie klucza zostaną usunięte, więc dotychczasowe hasło i kod odzyskiwania przestaną działać. Szyfrowanie będzie można później skonfigurować ponownie z nowym kluczem.",
      [
        { style: "cancel", text: "Anuluj" },
        {
          onPress: () => {
            void run(async () => {
              await removeEncryption();
              setDraftModules([]);
              setGeneratedRecoveryCode("");
              setNotice(
                "Szyfrowanie wyłączone. Wszystkie dane są teraz zapisane jawnie.",
              );
            });
          },
          style: "destructive",
          text: "Odszyfruj i usuń",
        },
      ],
    );
  }

  async function handleSaveModules() {
    await run(async () => {
      await saveEnabledModules(draftModules);
      setNotice(
        "Zakres szyfrowania zapisany. Istniejące dane zostały bezpiecznie zmigrowane.",
      );
    });
  }

  async function handleBiometricProtection(enabled: boolean) {
    await run(async () => {
      await setBiometricProtection(enabled);
      setNotice(
        enabled
          ? "Biometria chroni teraz lokalny klucz szyfrowania na tym urządzeniu."
          : "Wyłączono biometrię. Klucz pozostaje zapisany lokalnie w bezpiecznym magazynie urządzenia.",
      );
    });
  }

  async function handleBiometricUnlock() {
    await run(async () => {
      await unlockWithBiometrics();
      setNotice("Zaszyfrowane dane zostały odblokowane biometrią.");
    });
  }

  if (mode === "summary") {
    return (
      <View style={styles.card}>
        <Text style={styles.compactTitle}>Szyfrowanie danych</Text>
        <Text style={styles.meta}>Wybierz dane, które mają być chronione.</Text>
        <ActionButton
          onPress={() => onOpenConfiguration?.()}
          title="Otwórz konfigurację"
          variant="secondary"
        />
      </View>
    );
  }

  return (
    <View style={styles.configuration}>
      <View style={styles.introCard}>
        <Text style={styles.introTitle}>Jak to działa</Text>
        <Text style={styles.meta}>
          Dane są szyfrowane na telefonie przed wysłaniem. Serwer nie otrzymuje
          klucza.
        </Text>
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            Zapisz kod odzyskiwania. Bez urządzenia, hasła lub kodu danych nie
            można odzyskać.
          </Text>
        </View>
        <View style={styles.compatibilityBox}>
          <Text style={styles.compatibilityText}>
            Przed włączeniem upewnij się, że wszyscy członkowie tego domu mają
            HomeApp 1.1 lub nowszą. Wersja 1.0.0 nadal działa w domach bez
            szyfrowania, ale nie potrafi odczytać zaszyfrowanych modułów.
          </Text>
        </View>
      </View>

      {lockState === "loading" ? (
        <Text style={styles.meta}>Sprawdzanie klucza…</Text>
      ) : null}

      {lockState === "not-configured" && settings?.canManage ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wybierz dane do zaszyfrowania</Text>
          <Text style={styles.meta}>
            Po zatwierdzeniu istniejące dane zostaną zaszyfrowane na telefonie i
            zastąpione w bazie zaszyfrowanymi wartościami.
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.moduleCopy}>
              <Text style={styles.moduleLabel}>Dzisiaj</Text>
              <Text style={styles.moduleDescription}>
                Dziedziczy ochronę z kalendarza, jedzenia, zadań i finansów.
              </Text>
            </View>
            <Text style={styles.statusText}>Automatycznie</Text>
          </View>
          {moduleOptions.map((option) => (
            <View key={option.label} style={styles.moduleRow}>
              <View style={styles.moduleCopy}>
                <Text style={styles.moduleLabel}>{option.label}</Text>
                <Text style={styles.moduleDescription}>
                  {option.description}
                </Text>
              </View>
              <Switch
                disabled={busy}
                onValueChange={() => toggleModuleGroup(option.keys)}
                value={option.keys.every((module) =>
                  draftModules.includes(module),
                )}
              />
            </View>
          ))}
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassphrase}
            placeholder="Hasło szyfrowania (min. 12 znaków)"
            placeholderTextColor={theme.colors.textSubtle}
            secureTextEntry
            style={styles.input}
            value={passphrase}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassphraseConfirmation}
            placeholder="Powtórz hasło szyfrowania"
            placeholderTextColor={theme.colors.textSubtle}
            secureTextEntry
            style={styles.input}
            value={passphraseConfirmation}
          />
          <ActionButton
            loading={busy}
            onPress={handleSetup}
            title="Zaszyfruj wybrane dane"
          />
        </View>
      ) : null}

      {lockState === "not-configured" && settings && !settings.canManage ? (
        <InlineAlert text="Szyfrowanie nie zostało jeszcze skonfigurowane. Może je włączyć właściciel domu." />
      ) : null}

      {settings?.configured && lockState === "locked" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Odblokuj dane na tym telefonie
          </Text>
          <Text style={styles.meta}>
            Ten dom jest już zaszyfrowany. Odblokuj klucz, aby wyświetlić dane
            lub zmienić zakres ochrony.
          </Text>
          {biometricsEnabled ? (
            <ActionButton
              loading={busy}
              onPress={handleBiometricUnlock}
              title="Odblokuj biometrią"
            />
          ) : null}
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassphrase}
            placeholder="Hasło szyfrowania"
            placeholderTextColor={theme.colors.textSubtle}
            secureTextEntry
            style={styles.input}
            value={passphrase}
          />
          <ActionButton
            loading={busy}
            onPress={handleUnlock}
            title="Odblokuj hasłem"
          />

          <View style={styles.deviceKeyBox}>
            <Text style={styles.moduleLabel}>Klucz na tym telefonie</Text>
            <Text style={styles.meta}>
              {localKeyStored
                ? "Klucz jest zapisany lokalnie, ale dane pozostają zablokowane."
                : "Na tym telefonie nie ma zapisanego klucza. Odblokowanie hasłem zapisze go ponownie."}
            </Text>
            <ActionButton
              disabled={!localKeyStored || busy}
              onPress={() =>
                run(async () => {
                  await clearLocalKey();
                  setNotice("Usunięto lokalny klucz z tego telefonu.");
                })
              }
              title="Usuń klucz z tego telefonu"
              variant="secondary"
            />
          </View>

          <Text style={styles.sectionTitle}>Aktualnie zaszyfrowane</Text>
          <View style={styles.statusRow}>
            <Text style={styles.moduleLabel}>Dzisiaj</Text>
            <Text style={styles.statusText}>Według źródeł</Text>
          </View>
          {moduleOptions.map((option) => {
            const enabledCount = option.keys.filter((module) =>
              settings.enabledModules.includes(module),
            ).length;
            const enabled = enabledCount === option.keys.length;
            const partiallyEnabled = enabledCount > 0 && !enabled;

            return (
              <View key={option.label} style={styles.statusRow}>
                <Text style={styles.moduleLabel}>{option.label}</Text>
                <Text
                  style={[
                    styles.statusText,
                    enabled && styles.statusTextEnabled,
                  ]}
                >
                  {enabled
                    ? "Zaszyfrowane"
                    : partiallyEnabled
                      ? "Częściowo"
                      : "Nieszyfrowane"}
                </Text>
              </View>
            );
          })}

          {settings.canManage ? (
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Odzyskaj dostęp</Text>
              <TextInput
                autoCapitalize="none"
                onChangeText={setRecoveryCode}
                placeholder="Kod odzyskiwania"
                placeholderTextColor={theme.colors.textSubtle}
                style={styles.input}
                value={recoveryCode}
              />
              <TextInput
                autoCapitalize="none"
                onChangeText={setNewPassphrase}
                placeholder="Nowe hasło szyfrowania"
                placeholderTextColor={theme.colors.textSubtle}
                secureTextEntry
                style={styles.input}
                value={newPassphrase}
              />
              <ActionButton
                loading={busy}
                onPress={handleRecovery}
                title="Odzyskaj i ustaw nowe hasło"
                variant="secondary"
              />
            </View>
          ) : null}
          {settings.canManage && settings.enabledModules.length === 0 ? (
            <View style={styles.dangerZone}>
              <Text style={styles.dangerTitle}>
                Wyłącz szyfrowanie całkowicie
              </Text>
              <Text style={styles.meta}>
                Wszystkie chronione dane zostaną odszyfrowane. Konfiguracja i
                materiały kluczowe zostaną trwale usunięte.
              </Text>
              <ActionButton
                labelStyle={styles.dangerButtonLabel}
                loading={busy}
                onPress={handleRemoveEncryption}
                style={styles.dangerButton}
                title="Odszyfruj dane i usuń szyfrowanie"
                variant="secondary"
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {settings?.configured && lockState === "unlocked" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zakres szyfrowania</Text>
          <Text style={styles.meta}>
            Włączenie szyfruje istniejące i nowe dane. Wyłączenie odszyfrowuje
            istniejące dane przed zapisaniem ich w bazie.
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.moduleCopy}>
              <Text style={styles.moduleLabel}>Dzisiaj</Text>
              <Text style={styles.moduleDescription}>
                Dziedziczy ochronę z kalendarza, jedzenia, zadań i finansów.
              </Text>
            </View>
            <Text style={styles.statusText}>Automatycznie</Text>
          </View>
          {moduleOptions.map((option) => (
            <View key={option.label} style={styles.moduleRow}>
              <View style={styles.moduleCopy}>
                <Text style={styles.moduleLabel}>{option.label}</Text>
                <Text style={styles.moduleDescription}>
                  {option.description}
                </Text>
              </View>
              <Switch
                disabled={busy || !settings.canManage}
                onValueChange={() => toggleModuleGroup(option.keys)}
                value={option.keys.every((module) =>
                  draftModules.includes(module),
                )}
              />
            </View>
          ))}
          {settings.canManage ? (
            <ActionButton
              loading={busy}
              onPress={handleSaveModules}
              title="Zapisz zakres szyfrowania"
            />
          ) : null}

          <View style={styles.moduleRow}>
            <View style={styles.moduleCopy}>
              <Text style={styles.moduleLabel}>Odblokowanie biometrią</Text>
              <Text style={styles.moduleDescription}>
                Odcisk palca lub Face ID chroni lokalny klucz. Po zmianie
                zapisanej biometrii może być wymagane ponowne podanie hasła
                szyfrowania.
              </Text>
              {!biometricsAvailable ? (
                <Text style={styles.unavailableText}>
                  Skonfiguruj biometrię w ustawieniach telefonu, aby włączyć tę
                  opcję.
                </Text>
              ) : null}
            </View>
            <Switch
              disabled={busy || !biometricsAvailable}
              onValueChange={(enabled) =>
                void handleBiometricProtection(enabled)
              }
              value={biometricsEnabled}
            />
          </View>

          <ActionButton
            onPress={() =>
              run(async () => {
                await clearLocalKey();
                setNotice("Usunięto lokalny klucz z tego telefonu.");
              })
            }
            title="Usuń klucz z tego telefonu"
            variant="secondary"
          />
          {settings.canManage ? (
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>
                Nowe hasło i kod odzyskiwania
              </Text>
              <Text style={styles.meta}>
                Zmiana hasła obraca również klucz danych. Poprzedni kod
                odzyskiwania oraz klucze zapisane na innych telefonach przestaną
                działać. Te urządzenia trzeba ponownie odblokować nowym hasłem.
              </Text>
              <TextInput
                autoCapitalize="none"
                onChangeText={setNewPassphrase}
                placeholder="Nowe hasło szyfrowania"
                placeholderTextColor={theme.colors.textSubtle}
                secureTextEntry
                style={styles.input}
                value={newPassphrase}
              />
              <TextInput
                autoCapitalize="none"
                onChangeText={setPassphraseConfirmation}
                placeholder="Powtórz nowe hasło"
                placeholderTextColor={theme.colors.textSubtle}
                secureTextEntry
                style={styles.input}
                value={passphraseConfirmation}
              />
              <ActionButton
                loading={busy}
                onPress={handleRotateCredentials}
                title="Zmień hasło i wygeneruj nowy kod"
                variant="secondary"
              />
            </View>
          ) : null}
          {settings.canManage ? (
            <View style={styles.dangerZone}>
              <Text style={styles.dangerTitle}>
                Wyłącz szyfrowanie całkowicie
              </Text>
              <Text style={styles.meta}>
                Wszystkie chronione dane zostaną odszyfrowane. Konfiguracja i
                materiały kluczowe zostaną trwale usunięte.
              </Text>
              <ActionButton
                labelStyle={styles.dangerButtonLabel}
                loading={busy}
                onPress={handleRemoveEncryption}
                style={styles.dangerButton}
                title="Odszyfruj dane i usuń szyfrowanie"
                variant="secondary"
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {generatedRecoveryCode ? (
        <View style={styles.recoveryBox}>
          <Text style={styles.moduleLabel}>
            Kod odzyskiwania — zostanie pokazany tylko teraz
          </Text>
          <Text selectable style={styles.recoveryCode}>
            {generatedRecoveryCode}
          </Text>
          <ActionButton
            onPress={() => {
              void Clipboard.setStringAsync(generatedRecoveryCode);
              setNotice(
                "Kod skopiowany. Zapisz go w bezpiecznym miejscu poza telefonem.",
              );
            }}
            title="Kopiuj kod"
            variant="secondary"
          />
        </View>
      ) : null}

      {notice ? <InlineAlert text={notice} /> : null}
      {error ? <InlineAlert tone="error" text={error} /> : null}
      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>AI i usługi zewnętrzne</Text>
        <Text style={styles.meta}>
          Zaszyfrowane treści nie są wysyłane do AI automatycznie. Przed
          przekazaniem chronionych danych aplikacja pokaże ostrzeżenie i poprosi
          o zgodę na ich odszyfrowanie oraz wysłanie do zewnętrznej usługi AI.
        </Text>
      </View>
    </View>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 12,
      padding: 16,
    },
    compactTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
    configuration: { gap: 14 },
    compatibilityBox: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
      borderRadius: 10,
      borderWidth: 1,
      padding: 12,
    },
    compatibilityText: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 19,
    },
    deviceKeyBox: {
      backgroundColor: colors.cardMuted,
      borderRadius: 10,
      gap: 8,
      padding: 12,
    },
    dangerButton: { borderColor: colors.danger },
    dangerButtonLabel: { color: colors.danger },
    dangerTitle: { color: colors.danger, fontSize: 14, fontWeight: "800" },
    dangerZone: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      borderRadius: 10,
      borderWidth: 1,
      gap: 10,
      padding: 12,
    },
    form: { gap: 10 },
    infoCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 8,
      padding: 16,
    },
    input: {
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      color: colors.text,
      minWidth: 0,
      paddingHorizontal: 12,
      paddingVertical: 11,
      width: "100%",
    },
    introCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 10,
      padding: 16,
    },
    introTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
    meta: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
    moduleCopy: {
      flex: 1,
      flexShrink: 1,
      gap: 3,
      minWidth: 0,
      paddingRight: 12,
    },
    moduleDescription: {
      color: colors.textMuted,
      flexShrink: 1,
      fontSize: 12,
      lineHeight: 17,
    },
    moduleLabel: {
      color: colors.text,
      flexShrink: 1,
      fontSize: 14,
      fontWeight: "700",
    },
    moduleRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minWidth: 0,
      width: "100%",
    },
    noticeBox: {
      backgroundColor: colors.cardMuted,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    noticeText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
      lineHeight: 18,
    },
    recoveryBox: {
      backgroundColor: colors.primarySoft,
      borderRadius: 12,
      gap: 10,
      padding: 12,
    },
    recoveryCode: {
      color: colors.text,
      fontFamily: "monospace",
      fontSize: 13,
      lineHeight: 20,
    },
    section: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 12,
      padding: 16,
    },
    sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
    statusRow: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderRadius: 10,
      flexDirection: "row",
      gap: 8,
      justifyContent: "space-between",
      minWidth: 0,
      paddingHorizontal: 12,
      paddingVertical: 10,
      width: "100%",
    },
    statusText: {
      color: colors.textMuted,
      flexShrink: 0,
      fontSize: 12,
      fontWeight: "700",
      maxWidth: "42%",
      textAlign: "right",
    },
    statusTextEnabled: { color: colors.primaryDark },
    unavailableText: { color: colors.warning, fontSize: 11, lineHeight: 16 },
  });
}

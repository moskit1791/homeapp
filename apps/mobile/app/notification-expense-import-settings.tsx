import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useCallback, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { getMyHousehold, queryKeys } from "../src/api";
import {
  type DetectedNotificationSource,
  type NotificationImportSettings,
  notificationExpenseImport,
} from "../src/notification-expense-import/native";
import { useModulePermission } from "../src/permissions/use-permissions";
import { useSession } from "../src/session/session-context";
import { radii, spacing } from "../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../src/theme/use-app-theme";
import {
  ActionButton,
  AppScreen,
  FormModal,
  InlineAlert,
  QueryState,
  SectionCard,
} from "../src/ui";
import { Bell, Lock, Search, Smartphone } from "../src/ui/icon";

export default function NotificationExpenseImportSettingsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const { canCreate, canRead, permissionsQuery } =
    useModulePermission("finances");
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<
    "feature" | "repair" | "sources" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessConnected, setAccessConnected] = useState(false);
  const [reminderPermissionGranted, setReminderPermissionGranted] =
    useState(true);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [settings, setSettings] = useState<NotificationImportSettings | null>(
    null,
  );
  const [sources, setSources] = useState<DetectedNotificationSource[]>([]);
  const [search, setSearch] = useState("");
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [timeInput, setTimeInput] = useState("21:00");
  const accessToken = session?.accessToken;
  const householdQuery = useQuery({
    enabled: notificationExpenseImport.available && Boolean(accessToken),
    queryFn: () => getMyHousehold({ accessToken }),
    queryKey: queryKeys.household,
  });
  const goBack = useCallback(() => {
    router.replace({
      pathname: "/(tabs)/dom",
      params: { settings: "1" },
    } as never);
  }, [router]);

  const reload = useCallback(async () => {
    if (!notificationExpenseImport.available) {
      setLoading(false);
      return;
    }
    if (permissionsQuery.isLoading) {
      setLoading(true);
      return;
    }
    if (!canRead) {
      setSettings(null);
      setSources([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [access, storage, notificationPermission] = await Promise.all([
        notificationExpenseImport.getAccessStatus(),
        notificationExpenseImport.getStorageState(),
        Notifications.getPermissionsAsync(),
      ]);
      setAccessGranted(access.granted);
      setAccessConnected(access.connected);
      setReminderPermissionGranted(notificationPermission.status === "granted");
      setStorageUnavailable(storage.state === "unavailable");
      if (storage.state === "unavailable") {
        setSettings(null);
        setSources([]);
        return;
      }
      if (access.connected) {
        await notificationExpenseImport.refreshActiveNotifications();
        await waitForNotificationScan();
      }
      const [nextSettings, nextSources] = await Promise.all([
        notificationExpenseImport.getSettings(),
        notificationExpenseImport.listDetectedSources(),
      ]);
      setSettings(nextSettings);
      setSources(nextSources);
      setTimeInput(
        `${String(nextSettings.reminderHour).padStart(2, "0")}:${String(
          nextSettings.reminderMinute,
        ).padStart(2, "0")}`,
      );
    } catch {
      setError("Nie udało się odczytać lokalnych ustawień importu.");
    } finally {
      setLoading(false);
    }
  }, [canRead, permissionsQuery.isLoading]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  if (Platform.OS !== "android") {
    return (
      <AppScreen title="Import wydatków">
        <InlineAlert
          tone="info"
          text="Funkcja jest dostępna tylko na Androidzie. iOS nie pozwala aplikacjom odczytywać powiadomień innych aplikacji."
        />
        <ActionButton onPress={goBack} title="Wróć" />
      </AppScreen>
    );
  }

  if (permissionsQuery.isLoading) {
    return (
      <AppScreen title="Import wydatków">
        <QueryState isLoading />
      </AppScreen>
    );
  }

  if (!canRead) {
    return (
      <AppScreen title="Import wydatków">
        <InlineAlert
          tone="error"
          text="Nie masz uprawnienia do odczytu finansów."
        />
        <ActionButton onPress={goBack} title="Wróć" />
      </AppScreen>
    );
  }

  const visibleSources = sources.filter((source) =>
    `${source.displayName} ${source.packageName}`
      .toLocaleLowerCase("pl-PL")
      .includes(search.trim().toLocaleLowerCase("pl-PL")),
  );

  async function updateFeature(enabled: boolean) {
    if (!canCreate || busyAction) return;
    setBusyAction("feature");
    setError(null);
    try {
      await notificationExpenseImport.setFeatureEnabled(enabled);
      setSettings((current) =>
        current ? { ...current, featureEnabled: enabled } : current,
      );
      if (enabled) {
        const connected =
          await notificationExpenseImport.refreshActiveNotifications();
        setAccessConnected(connected);
        if (!connected) {
          setError(
            "Android nie połączył usługi importu. Na Xiaomi włącz Autostart dla HomeApp.",
          );
          return;
        }
        await waitForNotificationScan();
        setSources(await notificationExpenseImport.listDetectedSources());
      }
    } catch {
      setError(
        "Nie udało się zmienić działania importu. Odśwież lokalną kolejkę i spróbuj ponownie.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function updateSource(packageName: string, enabled: boolean) {
    if (busyAction) return;
    setBusyAction("sources");
    setError(null);
    try {
      await notificationExpenseImport.setSourceEnabled(packageName, enabled);
      setSources((current) =>
        current.map((source) =>
          source.packageName === packageName ? { ...source, enabled } : source,
        ),
      );
      if (enabled) {
        const connected =
          await notificationExpenseImport.refreshActiveNotifications();
        setAccessConnected(connected);
        if (!connected) {
          setError(
            "Android nie połączył usługi importu. Na Xiaomi włącz Autostart dla HomeApp.",
          );
        }
      }
    } catch {
      setError("Nie udało się zmienić wybranej aplikacji.");
    } finally {
      setBusyAction(null);
    }
  }

  async function refreshSources() {
    if (busyAction) return;
    setBusyAction("sources");
    setError(null);
    try {
      const connected =
        await notificationExpenseImport.refreshActiveNotifications();
      setAccessConnected(connected);
      if (!connected) {
        setError(
          "Zgoda jest włączona, ale usługa importu nie działa. Na Xiaomi włącz Autostart dla HomeApp.",
        );
        return;
      }
      await waitForNotificationScan();
      setSources(await notificationExpenseImport.listDetectedSources());
    } catch {
      setError("Nie udało się odświeżyć listy aplikacji.");
    } finally {
      setBusyAction(null);
    }
  }

  async function repairStorage() {
    if (busyAction) return;
    const profileId = session ? decodeJwtSubject(session.accessToken) : null;
    const householdId = householdQuery.data?.id;
    if (!session || !profileId || !householdId) {
      setError(
        "Nie udało się odtworzyć kontekstu konta. Zamknij i uruchom HomeApp ponownie.",
      );
      return;
    }

    setBusyAction("repair");
    setError(null);
    try {
      await notificationExpenseImport.resetUnavailableStorage();
      await notificationExpenseImport.setCaptureContext(
        profileId,
        householdId,
        canCreate,
        session.refreshTokenExpiresAt ?? null,
      );
      setStorageUnavailable(false);
      await reload();
    } catch {
      setError("Nie udało się odtworzyć lokalnej kolejki.");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveReminder() {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeInput.trim());
    if (!settings || !match) {
      setError("Podaj godzinę w formacie HH:MM.");
      return;
    }
    await notificationExpenseImport.setReminderSettings(
      settings.reminderEnabled,
      Number(match[1]),
      Number(match[2]),
    );
    setError(null);
    await reload();
  }

  async function updateReminderEnabled(enabled: boolean) {
    if (!settings) return;
    if (enabled && !reminderPermissionGranted) {
      const permission = await Notifications.requestPermissionsAsync();
      const granted = permission.status === "granted";
      setReminderPermissionGranted(granted);
      if (!granted) {
        setError(
          "Android nie pozwala wyświetlać przypomnień. Możesz zmienić tę decyzję w ustawieniach powiadomień HomeApp.",
        );
        return;
      }
    }
    await notificationExpenseImport.setReminderSettings(
      enabled,
      settings.reminderHour,
      settings.reminderMinute,
    );
    setSettings({ ...settings, reminderEnabled: enabled });
    setError(null);
  }

  return (
    <AppScreen
      actions={
        <ActionButton
          onPress={goBack}
          size="small"
          title="Wróć"
          variant="secondary"
        />
      }
      subtitle="Lokalne i prywatne rozpoznawanie płatności z wybranych aplikacji."
      title="Import wydatków"
    >
      {loading ? <QueryState isLoading /> : null}
      {error ? <InlineAlert tone="error" text={error} /> : null}
      {!canCreate ? (
        <InlineAlert
          tone="info"
          text="Nie masz uprawnienia do tworzenia wydatków. Przechwytywanie pozostaje wstrzymane."
        />
      ) : null}
      {storageUnavailable ? (
        <SectionCard
          icon={<Lock color={theme.colors.danger} size={19} />}
          title="Lokalna kolejka jest niedostępna"
        >
          <InlineAlert
            tone="error"
            text="Klucz Android Keystore został utracony albo unieważniony. Zatwierdzone wcześniej wydatki nie zostały utracone. Możesz wyczyścić wyłącznie niedostępną lokalną kolejkę."
          />
          <ActionButton
            disabled={busyAction !== null || householdQuery.isLoading}
            loading={busyAction === "repair"}
            onPress={() => void repairStorage()}
            title="Wyczyść kolejkę i utwórz nowy klucz"
            variant="secondary"
          />
        </SectionCard>
      ) : null}

      <SectionCard
        icon={<Smartphone color={theme.colors.finance} size={19} />}
        subtitle="Tylko Android"
        title="Dostęp systemowy"
      >
        <Text style={styles.body}>
          HomeApp nie łączy się z bankiem. Po nadaniu specjalnego dostępu
          Android przekazuje nowe powiadomienia do lokalnego parsera. Treść nie
          jest wysyłana na serwer ani do usług zewnętrznych.
        </Text>
        <InlineAlert
          tone={accessGranted && !accessConnected ? "error" : "info"}
          text={
            accessConnected
              ? "Dostęp do powiadomień jest aktywny."
              : accessGranted
                ? "Zgoda jest włączona, ale Android nie połączył usługi HomeApp. Na Xiaomi/MIUI włącz Autostart dla HomeApp, a następnie wróć do tego ekranu."
              : "Dostęp nie jest aktywny. To nie jest zwykłe uprawnienie runtime — trzeba włączyć usługę na ekranie systemowym Androida."
          }
        />
        {accessGranted && !accessConnected ? (
          <ActionButton
            onPress={() =>
              void notificationExpenseImport.openBackgroundSettings()
            }
            title="Otwórz Autostart Xiaomi"
            variant="secondary"
          />
        ) : null}
        <ActionButton
          onPress={() => {
            if (accessGranted) {
              void notificationExpenseImport.openAccessSettings();
            } else {
              setShowDisclosure(true);
            }
          }}
          title={
            accessGranted
              ? "Otwórz ustawienia systemowe"
              : "Włącz dostęp do powiadomień"
          }
        />
      </SectionCard>

      {settings ? (
        <SectionCard
          icon={<Bell color={theme.colors.finance} size={19} />}
          subtitle={`${settings.pendingCount} oczekujących`}
          title="Działanie i przypomnienie"
        >
          <SettingSwitch
            disabled={!canCreate || !accessConnected || busyAction !== null}
            label="Import z powiadomień"
            onValueChange={(value) => void updateFeature(value)}
            value={settings.featureEnabled}
          />
          <SettingSwitch
            label="Codzienne przypomnienie"
            onValueChange={(value) => void updateReminderEnabled(value)}
            value={settings.reminderEnabled}
          />
          {settings.reminderEnabled && !reminderPermissionGranted ? (
            <InlineAlert
              tone="info"
              text="Przypomnienie jest skonfigurowane, ale Android blokuje powiadomienia HomeApp. Wyłącz i włącz przełącznik, aby ponownie poprosić o zgodę."
            />
          ) : null}
          <View style={styles.timeRow}>
            <View style={styles.timeText}>
              <Text style={styles.label}>Godzina przypomnienia</Text>
              <Text style={styles.meta}>Domyślnie 21:00 czasu lokalnego</Text>
            </View>
            <TextInput
              accessibilityLabel="Godzina przypomnienia"
              maxLength={5}
              onChangeText={setTimeInput}
              placeholder="21:00"
              placeholderTextColor={theme.colors.textSubtle}
              style={styles.timeInput}
              value={timeInput}
            />
          </View>
          <ActionButton
            onPress={() => void saveReminder()}
            title="Zapisz godzinę"
            variant="secondary"
          />
          <ActionButton
            onPress={() => router.push("/notification-expense-import" as never)}
            title="Przejdź do oczekujących płatności"
          />
        </SectionCard>
      ) : null}

      <SectionCard
        icon={<Search color={theme.colors.finance} size={19} />}
        subtitle="Treść niewybranych aplikacji nie jest zapisywana"
        title="Wykryte aplikacje"
      >
        <TextInput
          onChangeText={setSearch}
          placeholder="Szukaj aplikacji"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.searchInput}
          value={search}
        />
        {visibleSources.length === 0 ? (
          <InlineAlert text="Brak wykrytych aplikacji. Po nadaniu dostępu lista uzupełni się na podstawie nowych powiadomień." />
        ) : (
          visibleSources.map((source) => (
            <View key={source.packageName} style={styles.sourceRow}>
              <View style={styles.sourceText}>
                <Text style={styles.sourceName}>{source.displayName}</Text>
                <Text style={styles.meta}>{source.packageName}</Text>
                <Text style={styles.meta}>
                  Ostatnio:{" "}
                  {new Date(source.lastSeenAt).toLocaleString("pl-PL")}
                </Text>
              </View>
              <Switch
                disabled={busyAction !== null}
                onValueChange={(value) =>
                  void updateSource(source.packageName, value)
                }
                value={source.enabled}
              />
            </View>
          ))
        )}
        {settings?.featureEnabled &&
        !sources.some((source) => source.enabled) ? (
          <InlineAlert
            tone="info"
            text="Import jest włączony. Wybierz niżej aplikację bankową, np. mBank. Po jej włączeniu HomeApp ponownie sprawdzi także aktualne powiadomienia."
          />
        ) : null}
        <ActionButton
          disabled={!accessConnected || busyAction !== null}
          loading={busyAction === "sources"}
          onPress={() => void refreshSources()}
          title="Odśwież wykryte aplikacje"
          variant="secondary"
        />
      </SectionCard>

      <SectionCard title="Dane lokalne">
        <Text style={styles.body}>
          System lub aplikacja bankowa może ukryć część treści, dlatego każdą
          pozycję trzeba sprawdzić przed zatwierdzeniem. Oczekujące dane są
          zaszyfrowane osobnym kluczem urządzenia i wyłączone z kopii zapasowej.
        </Text>
        <ActionButton
          onPress={async () => {
            await notificationExpenseImport.clearPending();
            await reload();
          }}
          title="Usuń lokalne dane oczekujące"
          variant="secondary"
        />
      </SectionCard>

      <FormModal
        footer={
          <>
            <ActionButton
              onPress={() => setShowDisclosure(false)}
              title="Nie teraz"
              variant="secondary"
            />
            <ActionButton
              onPress={async () => {
                setShowDisclosure(false);
                await notificationExpenseImport.openAccessSettings();
              }}
              title="Zgadzam się i przechodzę dalej"
            />
          </>
        }
        onClose={() => setShowDisclosure(false)}
        subtitle="Zgoda jest dobrowolna i możesz ją później cofnąć w ustawieniach Androida."
        title="Dostęp do powiadomień"
        visible={showDisclosure}
      >
        <Text style={styles.body}>
          HomeApp potrzebuje tego dostępu wyłącznie do lokalnego rozpoznawania
          informacji o płatnościach w powiadomieniach aplikacji, które sam
          wybierzesz.
        </Text>
        <Text style={styles.body}>
          Dla wybranych źródeł aplikacja odczyta tekst, kwotę, walutę i nazwę
          sprzedawcy. Parser działa na tym urządzeniu. Surowa treść
          powiadomienia, nazwa aplikacji bankowej, pakiet aplikacji i lokalny
          fingerprint nie są wysyłane do HomeApp API ani do usług zewnętrznych.
          Dopiero po Twoim zatwierdzeniu HomeApp wysyła dane tworzonego wydatku
          oraz losowy identyfikator techniczny potrzebny do ochrony przed
          podwójnym importem.
        </Text>
        <Text style={styles.body}>
          Każdy rozpoznany wydatek pozostaje szkicem do Twojego sprawdzenia. Bez
          tej zgody pozostałe funkcje HomeApp nadal działają.
        </Text>
      </FormModal>
    </AppScreen>
  );
}

function waitForNotificationScan(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 500));
}

function decodeJwtSubject(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(globalThis.atob(padded)) as { sub?: unknown };

    return typeof parsed.sub === "string" ? parsed.sub : null;
  } catch {
    return null;
  }
}

function SettingSwitch({
  disabled,
  label,
  onValueChange,
  value,
}: {
  disabled?: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  return (
    <Pressable
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.switchRow, disabled && styles.disabled]}
    >
      <Text style={styles.label}>{label}</Text>
      <Switch disabled={disabled} onValueChange={onValueChange} value={value} />
    </Pressable>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    body: { color: colors.text, fontSize: 14, lineHeight: 21 },
    disabled: { opacity: 0.5 },
    label: { color: colors.text, fontSize: 14, fontWeight: "700" },
    meta: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
    searchInput: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.text,
      fontSize: 14,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    sourceName: { color: colors.finance, fontSize: 15, fontWeight: "700" },
    sourceRow: {
      alignItems: "center",
      borderBottomColor: colors.line,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
      paddingVertical: spacing.sm,
    },
    sourceText: { flex: 1, gap: 2 },
    switchRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 48,
    },
    timeInput: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      minWidth: 82,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      textAlign: "center",
    },
    timeRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
    },
    timeText: { flex: 1, gap: 2 },
  });
}

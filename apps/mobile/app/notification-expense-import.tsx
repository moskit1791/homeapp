import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { useCallback, useMemo, useState } from "react";
import {
  Platform,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getFinanceSummary,
  getMyHousehold,
  importExpenses,
  queryKeys,
  type ImportExpenseItemRequest,
} from "../src/api";
import {
  decryptBudgetMonthDetail,
  sealFinanceEnvelope,
} from "../src/encryption/finance-crypto";
import { useEncryption } from "../src/encryption/encryption-context";
import { EncryptionUnlockCard } from "../src/encryption/encryption-unlock-card";
import {
  type PendingNotificationTransaction,
  type DetectedNotificationSource,
  notificationExpenseImport,
} from "../src/notification-expense-import/native";
import {
  formatSourceAmountCurrency,
  parsePositiveMoney,
  parseSourceAmountCurrency,
  requirePositiveMoney,
} from "../src/notification-expense-import/money";
import { useModulePermission } from "../src/permissions/use-permissions";
import { useSession } from "../src/session/session-context";
import { radii, spacing } from "../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../src/theme/use-app-theme";
import {
  ActionButton,
  AppScreen,
  EmptyState,
  InlineAlert,
  QueryState,
  SectionCard,
} from "../src/ui";

type Draft = PendingNotificationTransaction & {
  expanded: boolean;
  selected: boolean;
  sourceAmountCurrency: string;
  sourceIconDataUrl: string | null;
};

export default function NotificationExpenseImportReviewScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const { session } = useSession();
  const { canCreate, canRead, permissionsQuery } =
    useModulePermission("finances");
  const encryption = useEncryption();
  const accessToken = session?.accessToken;
  const financeEncrypted = encryption.isModuleEnabled("finances");
  const financeUnlocked =
    !financeEncrypted || encryption.lockState === "unlocked";
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    if (!notificationExpenseImport.available || !canRead) {
      setDrafts({});
      setQueueLoading(false);
      return;
    }
    setQueueLoading(true);
    try {
      const [pending, sources] = await Promise.all([
        notificationExpenseImport.listPending(),
        notificationExpenseImport.listDetectedSources(),
      ]);
      const sourceIcons = new Map(
        sources.map((source: DetectedNotificationSource) => [
          source.packageName,
          source.iconDataUrl,
        ]),
      );
      setDrafts(
        Object.fromEntries(
          pending.map((item) => [
            item.id,
            {
              ...item,
              budgetAmount:
                item.budgetAmount ?? (item.currency ? item.amount : null),
              expanded: false,
              merchant: item.merchant ?? "Wydatek z powiadomienia",
              selected: item.transactionType !== "refund",
              sourceAmountCurrency: formatSourceAmountCurrency(
                item.amount,
                item.currency,
              ),
              sourceIconDataUrl: sourceIcons.get(item.sourcePackage) ?? null,
            },
          ]),
        ),
      );
      setQueueError(null);
    } catch {
      setQueueError(
        "Nie udało się odszyfrować lokalnej kolejki. Otwórz ustawienia importu, aby sprawdzić stan klucza.",
      );
    } finally {
      setQueueLoading(false);
    }
  }, [canRead]);

  useFocusEffect(
    useCallback(() => {
      void loadQueue();
    }, [loadQueue]),
  );

  const householdQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => getMyHousehold({ accessToken }),
    queryKey: queryKeys.household,
  });
  const financeQuery = useQuery({
    enabled: canRead && Boolean(accessToken) && financeUnlocked,
    queryFn: async () =>
      decryptBudgetMonthDetail(
        await getFinanceSummary({ accessToken }),
        encryption.decryptPayload,
      ),
    queryKey: queryKeys.finances,
  });
  const candidates = Object.values(drafts);
  const selected = candidates.filter((candidate) => candidate.selected);
  const budgetItems =
    financeQuery.data?.categories.flatMap((category) =>
      category.items.map((item) => ({
        id: item.id,
        label: `${category.name} / ${item.name}`,
      })),
    ) ?? [];
  const householdCurrency = householdQuery.data?.currencyCode ?? "PLN";
  const invalidSelected = selected.some((item) => {
    const source = parseSourceAmountCurrency(item.sourceAmountCurrency);
    const finalAmountText = item.budgetAmount || source?.amountText;
    const finalAmount = parsePositiveMoney(finalAmountText);
    return (
      !item.budgetItemId ||
      !item.merchant?.trim() ||
      source === null ||
      finalAmount === null
    );
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const refreshedPermissions = await permissionsQuery.refetch();
      const permission = refreshedPermissions.data?.find(
        (item) => item.moduleKey === "finances",
      );
      if (!permission?.canCreate) {
        throw new Error("Brak aktualnego uprawnienia do tworzenia wydatków.");
      }
      if (financeEncrypted && encryption.lockState !== "unlocked") {
        throw new Error("Najpierw odblokuj zaszyfrowane finanse.");
      }

      const items: ImportExpenseItemRequest[] = await Promise.all(
        selected.map(async (item) => {
          const source = parseSourceAmountCurrency(item.sourceAmountCurrency);
          if (!source) {
            throw new Error("Uzupełnij kwotę źródłową i walutę.");
          }
          const finalAmount = requirePositiveMoney(
            item.budgetAmount || source.amountText,
          );
          const originalAmount = source.amount;
          const name = item.merchant?.trim() || "Wydatek z powiadomienia";
          await notificationExpenseImport.updatePending(item.id, {
            amount: originalAmount.toFixed(2),
            budgetAmount: finalAmount.toFixed(2),
            budgetItemId: item.budgetItemId,
            currency: source.currency,
            merchant: name,
          });
          const envelope = financeEncrypted
            ? await sealFinanceEnvelope(
                "expense",
                {
                  amount: finalAmount,
                  name,
                  occurredAt: item.occurredAt,
                  originalAmount,
                  originalCurrency: source.currency,
                  source: "bank_notification",
                },
                {
                  encryptPayload: encryption.encryptPayload,
                  keyVersion: encryption.settings?.keyVersion,
                },
              )
            : {};

          return {
            amount: financeEncrypted ? 0.01 : finalAmount,
            budgetItemId: item.budgetItemId ?? "",
            clientId: item.id,
            sourceExternalId: item.sourceExternalId,
            ...(financeEncrypted
              ? {}
              : {
                  name,
                  occurredAt: item.occurredAt,
                  originalAmount,
                  originalCurrency: source.currency,
                }),
            ...envelope,
          };
        }),
      );

      return importExpenses({ items }, { accessToken });
    },
    onSuccess: async (result) => {
      const completed = result.items.filter(
        (item) => item.status === "created" || item.status === "duplicate",
      );
      await Promise.all(
        completed.map((item) =>
          notificationExpenseImport.markImported(item.clientId),
        ),
      );
      const failed = result.items.length - completed.length;
      setResultMessage(
        failed > 0
          ? `Zapisano ${completed.length} wydatków. ${failed} pozycji wymaga ponownej próby.`
          : `Zapisano ${completed.length} wydatków.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.finances }),
        queryClient.invalidateQueries({ queryKey: queryKeys.start }),
        loadQueue(),
      ]);
    },
  });

  function patchDraft(id: string, changes: Partial<Draft>) {
    setDrafts((current) => {
      const existing = current[id];
      if (!existing) return current;

      return {
        ...current,
        [id]: { ...existing, ...changes },
      };
    });
  }

  if (Platform.OS !== "android") {
    return (
      <AppScreen title="Oczekujące płatności">
        <InlineAlert
          tone="info"
          text="Import z powiadomień jest dostępny tylko na Androidzie."
        />
      </AppScreen>
    );
  }

  if (permissionsQuery.isLoading) {
    return (
      <AppScreen title="Oczekujące płatności">
        <QueryState isLoading />
      </AppScreen>
    );
  }

  if (!canRead) {
    return (
      <AppScreen title="Oczekujące płatności">
        <InlineAlert
          tone="error"
          text="Nie masz uprawnienia do odczytu finansów."
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      actions={
        <ActionButton
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/(tabs)/finanse" as never)
          }
          size="small"
          title="Wróć"
          variant="secondary"
        />
      }
      subtitle="Sprawdź dane i przypisz każdą płatność do pozycji budżetu."
      title="Oczekujące płatności"
    >
      {queueLoading ? <QueryState isLoading /> : null}
      {queueError ? <InlineAlert tone="error" text={queueError} /> : null}
      {resultMessage ? <InlineAlert text={resultMessage} /> : null}
      {!canCreate ? (
        <InlineAlert
          tone="info"
          text="Możesz przejrzeć kolejkę, ale nie masz uprawnienia do tworzenia wydatków."
        />
      ) : null}
      {financeEncrypted && !financeUnlocked ? (
        <EncryptionUnlockCard modules={["finances"]} />
      ) : null}

      {!queueLoading && !queueError && candidates.length === 0 ? (
        <EmptyState
          text="Nowe rozpoznane płatności pojawią się tutaj po włączeniu źródeł."
          title="Nie masz płatności oczekujących na przypisanie."
        />
      ) : null}

      {candidates.map((candidate) => {
        const parsedAmount = parsePositiveMoney(candidate.amount);
        const selectedBudgetLabel = budgetItems.find(
          (item) => item.id === candidate.budgetItemId,
        )?.label;

        return (
          <SectionCard
            key={candidate.id}
            action={
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  patchDraft(candidate.id, {
                    selected: !candidate.selected,
                  })
                }
                style={[
                  styles.selectionBadge,
                  candidate.selected && styles.selectionBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.selectionText,
                    candidate.selected && styles.selectionTextActive,
                  ]}
                >
                  {candidate.selected ? "Wybrano" : "Pominięto"}
                </Text>
              </Pressable>
            }
            style={styles.candidateCard}
            subtitle={`${candidate.sourceAppName} • ${new Date(
              candidate.occurredAt,
            ).toLocaleString("pl-PL")}`}
            title={candidate.merchant?.trim() || "Wydatek z powiadomienia"}
          >
            <View style={styles.compactRow}>
              {candidate.sourceIconDataUrl ? (
                <Image
                  accessibilityIgnoresInvertColors
                  source={{ uri: candidate.sourceIconDataUrl }}
                  style={styles.sourceIcon}
                />
              ) : (
                <View style={styles.sourceIconFallback}>
                  <Text style={styles.sourceIconFallbackText}>↗</Text>
                </View>
              )}
              <View style={styles.compactInfo}>
                <Text style={styles.statusText}>
                  {candidate.requiresReview ? "Sprawdź dane" : "Rozpoznano"}
                </Text>
                <Text numberOfLines={1} style={styles.meta}>
                  {selectedBudgetLabel ?? "Wybierz pozycję budżetową"}
                </Text>
              </View>
              <Text style={styles.compactAmount}>
                {parsedAmount === null
                  ? `${candidate.amount ?? "—"} ${candidate.currency ?? ""}`
                  : formatMoneyWithCode(
                      parsedAmount,
                      candidate.currency ?? householdCurrency,
                    )}
              </Text>
            </View>

            <View style={styles.compactActions}>
              <Text style={styles.meta}>
                {transactionTypeLabel(candidate.transactionType)} • pewność{" "}
                {Math.round(candidate.confidence * 100)}%
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  patchDraft(candidate.id, {
                    expanded: !candidate.expanded,
                  })
                }
                style={styles.expandButton}
              >
                <Text style={styles.expandButtonText}>
                  {candidate.expanded ? "Zwiń" : "Edytuj"}
                </Text>
              </Pressable>
            </View>

            {candidate.expanded ? (
              <View style={styles.details}>
                <View style={styles.twoColumns}>
                  <Field
                    label="Nazwa wydatku"
                    onChangeText={(merchant) =>
                      patchDraft(candidate.id, { merchant })
                    }
                    value={candidate.merchant ?? ""}
                  />
                  <Field
                    autoCapitalize="characters"
                    autoCorrect={false}
                    label="Kwota i waluta"
                    onChangeText={(sourceAmountCurrency) => {
                      const source =
                        parseSourceAmountCurrency(sourceAmountCurrency);
                      patchDraft(candidate.id, {
                        sourceAmountCurrency,
                        ...(source
                          ? {
                              amount: source.amountText,
                              budgetAmount: source.amountText,
                              currency: source.currency,
                            }
                          : {}),
                      });
                    }}
                    placeholder="18,50 EUR"
                    value={candidate.sourceAmountCurrency}
                  />
                </View>
                <Text style={styles.fieldLabel}>Pozycja budżetowa</Text>
                <View style={styles.choices}>
                  {budgetItems.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        patchDraft(candidate.id, { budgetItemId: item.id })
                      }
                      style={[
                        styles.choice,
                        candidate.budgetItemId === item.id &&
                          styles.choiceActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          candidate.budgetItemId === item.id &&
                            styles.choiceTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <ActionButton
                  onPress={async () => {
                    await notificationExpenseImport.ignorePending(candidate.id);
                    await loadQueue();
                  }}
                  title="To nie jest wydatek"
                  variant="secondary"
                />
              </View>
            ) : null}
          </SectionCard>
        );
      })}

      {selected.length > 0 ? (
        <SectionCard
          subtitle={sourceCurrencySummary(selected)}
          title={`Wybrano: ${selected.length}`}
        >
          <Text style={styles.budgetSummary}>
            Suma budżetowa:{" "}
            {formatMoneyWithCode(
              budgetCurrencyTotal(selected),
              householdCurrency,
            )}
          </Text>
          <Text style={styles.summary}>
            Kwoty budżetowe są zapisywane wyłącznie w walucie domu (
            {householdCurrency}). HomeApp nie wykonuje automatycznej konwersji.
          </Text>
          {invalidSelected ? (
            <InlineAlert
              tone="info"
              text="Uzupełnij nazwę, kwotę z walutą i pozycję budżetową dla każdej wybranej płatności."
            />
          ) : null}
          {importMutation.error ? (
            <InlineAlert
              tone="error"
              text={
                importMutation.error instanceof Error
                  ? importMutation.error.message
                  : "Nie udało się zatwierdzić wydatków."
              }
            />
          ) : null}
          <ActionButton
            disabled={
              invalidSelected ||
              !canCreate ||
              !financeUnlocked ||
              importMutation.isPending
            }
            loading={importMutation.isPending}
            onPress={() => importMutation.mutate()}
            title="Zatwierdź wydatki"
          />
        </SectionCard>
      ) : null}
    </AppScreen>
  );
}

function Field({
  label,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.textSubtle}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

function sourceCurrencySummary(items: Draft[]): string {
  const totals = new Map<string, number>();
  for (const item of items) {
    const source = parseSourceAmountCurrency(item.sourceAmountCurrency);
    if (!source) continue;
    totals.set(
      source.currency,
      (totals.get(source.currency) ?? 0) + source.amount,
    );
  }
  return [...totals.entries()]
    .map(([currency, amount]) => formatMoneyWithCode(amount, currency))
    .join(" • ");
}

function budgetCurrencyTotal(items: Draft[]): number {
  return items.reduce((total, item) => {
    const source = parseSourceAmountCurrency(item.sourceAmountCurrency);
    const amount = parsePositiveMoney(item.budgetAmount || source?.amountText);
    return total + (amount ?? 0);
  }, 0);
}

function formatMoneyWithCode(value: number, currency: string): string {
  return `${value.toLocaleString("pl-PL", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} ${currency}`;
}

function transactionTypeLabel(value: Draft["transactionType"]): string {
  return (
    {
      payment: "płatność",
      refund: "zwrot — wymaga sprawdzenia",
      transfer_out: "przelew wychodzący",
      unknown: "nierozpoznany",
      withdrawal: "wypłata z bankomatu",
    } as const
  )[value];
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    candidateCard: {
      gap: spacing.sm,
      padding: spacing.md,
    },
    choice: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    choiceActive: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.finance,
    },
    choiceText: { color: colors.text, fontSize: 12 },
    choiceTextActive: { color: colors.finance, fontWeight: "700" },
    choices: { gap: spacing.xs },
    compactActions: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    compactAmount: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
    },
    compactInfo: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    compactRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    details: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: spacing.md,
      paddingTop: spacing.md,
    },
    expandButton: {
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    expandButtonText: {
      color: colors.finance,
      fontSize: 12,
    },
    field: { flex: 1, gap: spacing.xs },
    fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
    budgetSummary: {
      color: colors.finance,
      fontSize: 17,
      lineHeight: 23,
    },
    input: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    meta: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
    selectionBadge: {
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    selectionBadgeActive: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.finance,
    },
    selectionText: { color: colors.textMuted, fontSize: 11 },
    selectionTextActive: { color: colors.finance, fontWeight: "700" },
    statusText: { color: colors.finance, fontSize: 13 },
    sourceIcon: { borderRadius: 8, height: 32, width: 32 },
    sourceIconFallback: {
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderRadius: 8,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    sourceIconFallbackText: { color: colors.finance, fontSize: 16 },
    summary: { color: colors.text, fontSize: 13, lineHeight: 19 },
    twoColumns: { flexDirection: "row", gap: spacing.sm },
  });
}

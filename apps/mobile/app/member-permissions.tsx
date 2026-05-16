import { MODULE_KEYS, type ModuleKey } from "@homeapp/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  listHouseholdMembers,
  listMemberPermissions,
  queryKeys,
  updateMemberPermissions,
  type EffectivePermission,
  type HouseholdMember,
} from "../src/api";
import { useModulePermission } from "../src/permissions/use-permissions";
import { useSession } from "../src/session/session-context";
import { radii, spacing } from "../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../src/theme/use-app-theme";
import { ActionButton, AppScreen, AppToast, IconButton, InlineAlert, QueryState } from "../src/ui";
import { ChevronLeft, ShieldCheck } from "../src/ui/icon";

type PermissionKey = "canRead" | "canCreate" | "canUpdate" | "canDelete";

const permissionActions: Array<{ key: PermissionKey; label: string }> = [
  { key: "canRead", label: "Odczyt" },
  { key: "canCreate", label: "Dodawanie" },
  { key: "canUpdate", label: "Edycja" },
  { key: "canDelete", label: "Usuwanie" },
];

const moduleCopy: Record<ModuleKey, { label: string; meta: string }> = {
  annual_costs: {
    label: "Koszty roczne",
    meta: "Opłaty cykliczne i ich historia.",
  },
  attachments: {
    label: "Pliki",
    meta: "Załączniki, rachunki i dokumenty.",
  },
  calendar: {
    label: "Kalendarz",
    meta: "Wydarzenia domowe i osobiste.",
  },
  cleaning: {
    label: "Sprzątanie",
    meta: "Zadania i harmonogram porządków.",
  },
  data_entries: {
    label: "Dane",
    meta: "Domowy sejf danych i notatek technicznych.",
  },
  finances: {
    label: "Finanse",
    meta: "Budżety, dochody, wydatki i oszczędności.",
  },
  household_members: {
    label: "Członkowie domu",
    meta: "Ustawienia domu, zaproszenia i domownicy.",
  },
  meal_planner: {
    label: "Plan posiłków",
    meta: "Tygodnie, posiłki i inspiracje.",
  },
  notes: {
    label: "Notatki",
    meta: "Prywatne i robocze notatki.",
  },
  permissions: {
    label: "Uprawnienia",
    meta: "Dostęp domowników do modułów.",
  },
  shopping: {
    label: "Zakupy",
    meta: "Listy zakupów i pozycje.",
  },
  start: {
    label: "Dzisiaj",
    meta: "Ekran startowy i podsumowania dnia.",
  },
  todo: {
    label: "Do zrobienia",
    meta: "Wspólne zadania domowe.",
  },
};

export default function MemberPermissionsScreen() {
  const { session } = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ memberId?: string | string[] }>();
  const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const permissionAccess = useModulePermission("permissions");
  const [draft, setDraft] = useState<EffectivePermission[]>([]);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const membersQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listHouseholdMembers({ accessToken }),
    queryKey: [...queryKeys.household, "members"],
  });
  const permissionsQuery = useQuery({
    enabled: Boolean(accessToken && memberId),
    queryFn: () => listMemberPermissions(memberId ?? "", { accessToken }),
    queryKey: [...queryKeys.household, "members", memberId, "permissions"],
  });
  const member = useMemo(
    () => membersQuery.data?.find((item) => item.id === memberId),
    [memberId, membersQuery.data],
  );
  const isOwner = member?.role === "owner";
  const canEdit = permissionAccess.canUpdate && !isOwner;

  const permissionsMutation = useMutation({
    mutationFn: () =>
      updateMemberPermissions(memberId ?? "", { permissions: draft }, { accessToken }),
    onSuccess: async (permissions) => {
      setDraft(normalizePermissions(permissions));
      setDirty(false);
      showToast("Uprawnienia zapisane");
      await queryClient.invalidateQueries({ queryKey: queryKeys.permissions });
      await queryClient.invalidateQueries({ queryKey: queryKeys.household });
    },
  });
  const canSave =
    canEdit &&
    dirty &&
    Boolean(memberId) &&
    !permissionsMutation.isPending &&
    draft.length > 0;

  useEffect(() => {
    if (!permissionsQuery.data) {
      return;
    }

    setDraft(normalizePermissions(permissionsQuery.data));
    setDirty(false);
  }, [permissionsQuery.data]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  function togglePermission(moduleKey: ModuleKey, key: PermissionKey) {
    if (!canEdit) {
      return;
    }

    setDraft((current) =>
      current.map((permission) => {
        if (permission.moduleKey !== moduleKey) {
          return permission;
        }

        const next = {
          ...permission,
          [key]: !permission[key],
        };

        if (key === "canRead" && !next.canRead) {
          next.canCreate = false;
          next.canUpdate = false;
          next.canDelete = false;
        }

        if (key !== "canRead" && next[key]) {
          next.canRead = true;
        }

        return next;
      }),
    );
    setDirty(true);
  }

  return (
    <AppScreen
      leading={
        <IconButton accessibilityLabel="Wróć" onPress={() => router.back()}>
          <ChevronLeft color={theme.colors.text} size={22} />
        </IconButton>
      }
      subtitle={member ? memberSubtitle(member) : "Uprawnienia domownika"}
      title={member?.displayName ?? "Domownik"}
    >
      <AppToast offsetTop={74} text={toast} />
      {!memberId ? <InlineAlert tone="error" text="Brakuje identyfikatora domownika." /> : null}
      {isOwner ? (
        <InlineAlert text="Właściciel domu ma zawsze pełne uprawnienia i nie wymaga ręcznej konfiguracji." />
      ) : null}
      {!permissionAccess.canUpdate && !isOwner ? (
        <InlineAlert text="Masz podgląd uprawnień. Do zapisu potrzebujesz uprawnienia edycji modułu Uprawnienia." />
      ) : null}

      <QueryState
        error={membersQuery.error ?? permissionsQuery.error}
        isLoading={membersQuery.isLoading || permissionsQuery.isLoading}
      />

      <View style={styles.permissionList}>
        {draft.map((permission) => {
          const copy = moduleCopy[permission.moduleKey];

          return (
            <View key={permission.moduleKey} style={styles.permissionCard}>
              <View style={styles.permissionHeader}>
                <View style={styles.permissionIcon}>
                  <ShieldCheck color={theme.colors.primary} size={22} />
                </View>
                <View style={styles.permissionText}>
                  <Text style={styles.permissionTitle}>{copy.label}</Text>
                  <Text style={styles.permissionMeta}>{copy.meta}</Text>
                </View>
              </View>
              <View style={styles.toggleGrid}>
                {permissionActions.map((action) => (
                  <PermissionToggle
                    disabled={!canEdit}
                    key={action.key}
                    label={action.label}
                    onPress={() => togglePermission(permission.moduleKey, action.key)}
                    value={permission[action.key]}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>

      <ActionButton
        disabled={!canSave}
        loading={permissionsMutation.isPending}
        onPress={() => permissionsMutation.mutate()}
        title="Zapisz uprawnienia"
      />
      {permissionsMutation.error ? (
        <InlineAlert tone="error" text="Nie udało się zapisać uprawnień." />
      ) : null}
    </AppScreen>
  );
}

function PermissionToggle({
  disabled,
  label,
  onPress,
  value,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  value: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.toggleButton,
        value && styles.toggleButtonActive,
        disabled && styles.toggleButtonDisabled,
      ]}
    >
      <Text style={[styles.toggleLabel, value && styles.toggleLabelActive]}>{label}</Text>
      <View style={[styles.switchTrack, value && styles.switchTrackActive]}>
        <View style={[styles.switchThumb, value && styles.switchThumbActive]} />
      </View>
    </Pressable>
  );
}

function normalizePermissions(permissions: EffectivePermission[]): EffectivePermission[] {
  const byModule = new Map(permissions.map((permission) => [permission.moduleKey, permission]));

  return MODULE_KEYS.map(
    (moduleKey) =>
      byModule.get(moduleKey) ?? {
        canCreate: false,
        canDelete: false,
        canRead: false,
        canUpdate: false,
        moduleKey,
      },
  );
}

function memberSubtitle(member: HouseholdMember): string {
  return [member.email, member.role === "owner" ? "właściciel" : "domownik"]
    .filter(Boolean)
    .join(" / ");
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    permissionCard: {
      backgroundColor: colors.overlay,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      elevation: 2,
      gap: spacing.md,
      padding: spacing.md,
      shadowColor: "#000000",
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 18,
    },
    permissionHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    permissionIcon: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderRadius: radii.control,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
    permissionList: {
      gap: spacing.sm,
    },
    permissionMeta: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    permissionText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    permissionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 0,
    },
    switchThumb: {
      alignSelf: "flex-start",
      backgroundColor: colors.card,
      borderRadius: 999,
      height: 20,
      width: 20,
    },
    switchThumbActive: {
      alignSelf: "flex-end",
    },
    switchTrack: {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 24,
      justifyContent: "center",
      padding: 2,
      width: 44,
    },
    switchTrackActive: {
      backgroundColor: colors.primary,
    },
    toggleButton: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      minHeight: 46,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      width: "48.5%",
    },
    toggleButtonActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    toggleButtonDisabled: {
      opacity: 0.62,
    },
    toggleGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    toggleLabel: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
    },
    toggleLabelActive: {
      color: colors.text,
      fontWeight: "900",
    },
  });
}

import type { ModuleKey } from "@homeapp/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  LogOut,
  MailPlus,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "../../src/ui/icon";
import {
  getMyHousehold,
  inviteHouseholdMember,
  listHouseholdMembers,
  queryKeys,
  removeHouseholdMember,
  type EffectivePermission,
  type HouseholdMember,
} from "../../src/api";
import {
  useModulePermission,
  usePermissions,
} from "../../src/permissions/use-permissions";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import {
  ActionButton,
  AppScreen,
  FormModal,
  IconButton,
  InlineAlert,
  QueryState,
  SectionCard,
} from "../../src/ui";

type Accent = {
  color: string;
  soft: string;
};

const visibleModules: ModuleKey[] = [
  "start",
  "finances",
  "meal_planner",
  "calendar",
  "todo",
  "notes",
  "shopping",
  "cleaning",
  "annual_costs",
  "data_entries",
  "attachments",
  "household_members",
  "permissions",
];

export default function WiecejScreen() {
  const { logout, session } = useSession();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const permissionsQuery = usePermissions();
  const householdPermission = useModulePermission("household_members");
  const permissionsPermission = useModulePermission("permissions");

  return (
    <AppScreen
      subtitle="Członkowie domu, role i ustawienia konta."
      title="Więcej"
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Users color={theme.colors.primary} size={24} />
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.heroKicker}>Administracja</Text>
          <Text style={styles.heroTitle}>
            Zarządzaj domem bez szukania w ustawieniach systemu.
          </Text>
          <View style={styles.quickRow}>
            <QuickPill colors={theme.colors} text="Członkowie" tone="primary" />
            <QuickPill colors={theme.colors} text="Uprawnienia" tone="info" />
            <QuickPill colors={theme.colors} text="Konto" tone="warning" />
          </View>
        </View>
      </View>

      <HouseholdPanel
        accessToken={accessToken}
        canCreate={householdPermission.canCreate}
        canDelete={householdPermission.canDelete}
        canRead={householdPermission.canRead}
      />

      <PermissionsPanel
        canRead={permissionsPermission.canRead}
        isLoading={permissionsQuery.isLoading}
        permissions={permissionsQuery.data}
      />

      <TechPanel accessToken={accessToken} onLogout={logout} />
    </AppScreen>
  );
}

function HouseholdPanel({
  accessToken,
  canCreate,
  canDelete,
  canRead,
}: {
  accessToken?: string;
  canCreate: boolean;
  canDelete: boolean;
  canRead: boolean;
}) {
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accent = getAccent(theme.colors, "members");
  const [email, setEmail] = useState("");
  const [inviteVisible, setInviteVisible] = useState(false);

  const householdQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => getMyHousehold({ accessToken }),
    queryKey: [...queryKeys.household, "me"],
  });

  const membersQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => listHouseholdMembers({ accessToken }),
    queryKey: [...queryKeys.household, "members"],
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteHouseholdMember({ email: email.trim() }, { accessToken }),
    onSuccess: async () => {
      setEmail("");
      setInviteVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.household });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      removeHouseholdMember(memberId, { accessToken }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.household }),
  });

  const members = membersQuery.data ?? [];
  const ownerCount = members.filter((member) => member.role === "owner").length;
  const canInvite =
    canCreate && Boolean(email.trim()) && !inviteMutation.isPending;

  return (
    <Panel
      action={
        canCreate ? (
          <ActionButton
            onPress={() => setInviteVisible(true)}
            size="small"
            title="+ Zaproś"
          />
        ) : undefined
      }
      accent={accent}
      icon={<Users color={accent.color} size={18} />}
      onRefresh={() => {
        householdQuery.refetch();
        membersQuery.refetch();
      }}
      subtitle={`${members.length} członków / ${ownerCount} właścicieli`}
      title="Członkowie domu"
    >
      {!canRead ? (
        <InlineAlert
          tone="info"
          text="Nie masz uprawnienia do podglądu członków domu."
        />
      ) : (
        <>
          {householdQuery.data ? (
            <View style={styles.summaryRow}>
              <MetricTile
                colors={theme.colors}
                label="Dom"
                value={householdQuery.data.name}
              />
              <MetricTile
                colors={theme.colors}
                label="Waluta"
                value={householdQuery.data.currencyCode}
              />
            </View>
          ) : null}

          <QueryState
            emptyText="Brak członków domu."
            error={membersQuery.error}
            isEmpty={
              !membersQuery.isLoading &&
              !membersQuery.error &&
              members.length === 0
            }
            isLoading={membersQuery.isLoading}
          />
          <View style={styles.itemList}>
            {members.map((member) => (
              <MemberRow
                accent={accent}
                canDelete={canDelete && member.role !== "owner"}
                deleting={removeMutation.isPending}
                key={member.id}
                member={member}
                onDelete={() => removeMutation.mutate(member.id)}
              />
            ))}
          </View>
          {inviteMutation.data ? (
            <InlineAlert
              text={`Zaproszenie wysłane do ${inviteMutation.data.email}.`}
            />
          ) : null}
          <FormModal
            footer={
              <View style={styles.modalFooter}>
                <ActionButton
                  onPress={() => setInviteVisible(false)}
                  style={styles.modalFooterButton}
                  title="Anuluj"
                  variant="secondary"
                />
                <ActionButton
                  disabled={!canInvite}
                  loading={inviteMutation.isPending}
                  onPress={() => inviteMutation.mutate()}
                  style={styles.modalFooterButton}
                  title="Zaproś"
                />
              </View>
            }
            onClose={() => setInviteVisible(false)}
            subtitle="Zaproszona osoba dostanie możliwość dołączenia do domu."
            title="Zaproś domownika"
            visible={inviteVisible}
          >
            <View style={styles.modalLead}>
              <View style={[styles.formIcon, { backgroundColor: accent.soft }]}>
                <MailPlus color={accent.color} size={18} />
              </View>
              <Text style={styles.formHint}>
                Podaj adres osoby, która ma dołączyć do domu.
              </Text>
            </View>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="email@dom.pl"
              placeholderTextColor={theme.colors.textSubtle}
              style={styles.input}
              value={email}
            />
            {inviteMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się zaprosić osoby." />
            ) : null}
          </FormModal>
        </>
      )}
    </Panel>
  );
}

function PermissionsPanel({
  canRead,
  isLoading,
  permissions,
}: {
  canRead: boolean;
  isLoading: boolean;
  permissions: EffectivePermission[] | undefined;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accent = getAccent(theme.colors, "permissions");
  const readableCount =
    permissions?.filter((permission) => permission.canRead).length ?? 0;

  return (
    <Panel
      accent={accent}
      icon={<ShieldCheck color={accent.color} size={18} />}
      onRefresh={() => undefined}
      subtitle={`${readableCount} modułów widocznych`}
      title="Uprawnienia"
    >
      {!canRead ? (
        <InlineAlert
          tone="info"
          text="Nie masz uprawnienia do modułu uprawnień."
        />
      ) : null}

      {canRead && isLoading ? <QueryState isLoading /> : null}

      {canRead && permissions ? (
        <View style={styles.permissionList}>
          {visibleModules.map((moduleKey) => {
            const permission = permissions.find(
              (item) => item.moduleKey === moduleKey,
            );

            return (
              <View
                key={moduleKey}
                style={[
                  styles.permissionRow,
                  { borderLeftColor: accent.color },
                ]}
              >
                <View style={styles.permissionText}>
                  <Text style={styles.itemName}>{moduleLabel(moduleKey)}</Text>
                  <Text style={styles.itemMeta}>
                    {permissionSummary(permission)}
                  </Text>
                </View>
                <View style={styles.permissionBadges}>
                  <PermissionBadge
                    active={Boolean(permission?.canRead)}
                    colors={theme.colors}
                    label="R"
                  />
                  <PermissionBadge
                    active={Boolean(permission?.canCreate)}
                    colors={theme.colors}
                    label="C"
                  />
                  <PermissionBadge
                    active={Boolean(permission?.canUpdate)}
                    colors={theme.colors}
                    label="U"
                  />
                  <PermissionBadge
                    active={Boolean(permission?.canDelete)}
                    colors={theme.colors}
                    label="D"
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </Panel>
  );
}

function TechPanel({
  accessToken,
  onLogout,
}: {
  accessToken?: string;
  onLogout: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accent = getAccent(theme.colors, "settings");

  return (
    <SectionCard
      icon={<LogOut color={accent.color} size={18} />}
      subtitle={accessToken ? "Sesja aktywna" : "Brak aktywnej sesji"}
      title="Ustawienia konta"
    >
      <View style={[styles.settingsBox, { backgroundColor: accent.soft }]}>
        <View style={styles.settingsText}>
          <Text style={styles.itemName}>Sesja i bezpieczeństwo</Text>
          <Text style={styles.itemMeta}>
            Wylogowanie usuwa aktywny token z aplikacji.
          </Text>
        </View>
        <ActionButton onPress={onLogout} title="Wyloguj" variant="secondary" />
      </View>
    </SectionCard>
  );
}

function MemberRow({
  accent,
  canDelete,
  deleting,
  member,
  onDelete,
}: {
  accent: Accent;
  canDelete: boolean;
  deleting: boolean;
  member: HouseholdMember;
  onDelete: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={[styles.itemRow, { borderLeftColor: accent.color }]}>
      <View style={styles.avatar}>
        <UserPlus color={accent.color} size={18} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{member.displayName}</Text>
        <Text style={styles.itemMeta}>
          {member.email} / {member.role === "owner" ? "właściciel" : "domownik"}
        </Text>
      </View>
      {canDelete ? (
        <IconButton disabled={deleting} onPress={onDelete}>
          <Trash2 color={theme.colors.danger} size={17} />
        </IconButton>
      ) : null}
    </View>
  );
}

function Panel({
  accent,
  action,
  children,
  icon,
  onRefresh,
  subtitle,
  title,
}: {
  accent: Accent;
  action?: ReactNode;
  children: ReactNode;
  icon: ReactNode;
  onRefresh: () => void;
  subtitle: string;
  title: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <SectionCard
      action={
        <View style={styles.panelActions}>
          {action}
          <IconButton onPress={onRefresh}>
            <RefreshCcw color={theme.colors.textMuted} size={18} />
          </IconButton>
        </View>
      }
      icon={icon}
      subtitle={subtitle}
      title={title}
    >
      <View style={[styles.panelAccent, { backgroundColor: accent.soft }]} />
      {children}
    </SectionCard>
  );
}

function PermissionBadge({
  active,
  colors,
  label,
}: {
  active: boolean;
  colors: AppPalette;
  label: string;
}) {
  const styles = createStyles(colors);

  return (
    <View
      style={[styles.permissionBadge, active && styles.permissionBadgeActive]}
    >
      <Text
        style={[
          styles.permissionBadgeText,
          active && styles.permissionBadgeTextActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function MetricTile({
  colors,
  label,
  value,
}: {
  colors: AppPalette;
  label: string;
  value: string;
}) {
  const styles = createStyles(colors);

  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function QuickPill({
  colors,
  text,
  tone,
}: {
  colors: AppPalette;
  text: string;
  tone: "info" | "primary" | "warning";
}) {
  const styles = createStyles(colors);
  const toneStyles = {
    info: { backgroundColor: colors.softBlue, color: colors.calendar },
    primary: { backgroundColor: colors.primarySoft, color: colors.primaryDark },
    warning: { backgroundColor: colors.softOrange, color: colors.warning },
  };

  return <Text style={[styles.quickPill, toneStyles[tone]]}>{text}</Text>;
}

function getAccent(
  colors: AppPalette,
  section: "members" | "permissions" | "settings",
): Accent {
  const accents: Record<"members" | "permissions" | "settings", Accent> = {
    members: { color: colors.primary, soft: colors.primarySoft },
    permissions: { color: colors.calendar, soft: colors.softBlue },
    settings: { color: colors.warning, soft: colors.softOrange },
  };

  return accents[section];
}

function permissionSummary(
  permission: EffectivePermission | undefined,
): string {
  if (!permission) {
    return "Brak dostępu";
  }

  const flags = [
    permission.canRead ? "odczyt" : null,
    permission.canCreate ? "tworzenie" : null,
    permission.canUpdate ? "edycja" : null,
    permission.canDelete ? "usuwanie" : null,
  ].filter(Boolean);

  return flags.length ? flags.join(", ") : "Brak dostępu";
}

function moduleLabel(moduleKey: ModuleKey): string {
  const labels: Record<ModuleKey, string> = {
    annual_costs: "Koszty roczne",
    attachments: "Załączniki",
    calendar: "Kalendarz",
    cleaning: "Sprzątanie",
    data_entries: "Dane",
    finances: "Finanse",
    household_members: "Członkowie",
    meal_planner: "Plan jedzenia",
    notes: "Notatki",
    permissions: "Uprawnienia",
    shopping: "Zakupy",
    start: "Start",
    todo: "To-do",
  };

  return labels[moduleKey];
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    avatar: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderRadius: radii.control,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    formCard: {
      backgroundColor: colors.cardMuted,
      borderRadius: radii.control,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    formHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    formHeaderText: {
      flex: 1,
      gap: spacing.xs,
    },
    formHint: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    formIcon: {
      alignItems: "center",
      borderRadius: radii.control,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    formTitle: {
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    hero: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.lg,
    },
    heroContent: {
      flex: 1,
      gap: spacing.sm,
    },
    heroIcon: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderRadius: radii.control,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    heroKicker: {
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    heroTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 25,
    },
    input: {
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      letterSpacing: 0,
      minHeight: 46,
      paddingHorizontal: spacing.md,
    },
    itemContent: {
      flex: 1,
      gap: spacing.xs,
      paddingRight: spacing.sm,
    },
    itemList: {
      gap: spacing.sm,
    },
    itemMeta: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    itemName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 19,
    },
    itemRow: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      borderLeftWidth: 4,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 60,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    metricLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
    },
    metricValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
      letterSpacing: 0,
    },
    modalFooter: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    modalFooterButton: {
      flex: 1,
    },
    modalLead: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    panelAccent: {
      borderRadius: 999,
      height: 6,
    },
    panelActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    permissionBadge: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    permissionBadgeActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    permissionBadgeText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
    },
    permissionBadgeTextActive: {
      color: colors.inverseText,
    },
    permissionBadges: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    permissionList: {
      gap: spacing.sm,
    },
    permissionRow: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      borderLeftWidth: 4,
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
      padding: spacing.md,
    },
    permissionText: {
      flex: 1,
      gap: spacing.xs,
    },
    quickPill: {
      borderRadius: 999,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      overflow: "hidden",
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    quickRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    settingsBox: {
      alignItems: "center",
      borderRadius: radii.control,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      justifyContent: "space-between",
      padding: spacing.md,
    },
    settingsText: {
      flex: 1,
      gap: spacing.xs,
      minWidth: 180,
    },
    summaryMetric: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.md,
      width: "48%",
    },
    summaryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
  });
}

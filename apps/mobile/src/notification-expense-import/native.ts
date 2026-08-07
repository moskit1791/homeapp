import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export interface DetectedNotificationSource {
  packageName: string;
  displayName: string;
  iconDataUrl: string | null;
  enabled: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface PendingNotificationTransaction {
  id: string;
  sourceExternalId: string;
  sourcePackage: string;
  sourceAppName: string;
  amount: string | null;
  currency: string | null;
  merchant: string | null;
  budgetAmount: string | null;
  budgetItemId: string | null;
  transactionType:
    | "payment"
    | "transfer_out"
    | "withdrawal"
    | "refund"
    | "unknown";
  occurredAt: string;
  receivedAt: string;
  confidence: number;
  parserId: string;
  requiresReview: boolean;
  status: "pending" | "imported" | "ignored";
}

export interface NotificationImportSettings {
  featureEnabled: boolean;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  pendingCount: number;
}

interface NotificationExpenseImportNativeModule {
  getAccessStatus(): Promise<{ granted: boolean; connected: boolean }>;
  openAccessSettings(): Promise<boolean>;
  openBackgroundSettings(): Promise<boolean>;
  getStorageState(): Promise<{
    state: "available" | "unavailable";
    pendingCount: number;
  }>;
  refreshActiveNotifications(): Promise<boolean>;
  listDetectedSources(): Promise<DetectedNotificationSource[]>;
  setSourceEnabled(packageName: string, enabled: boolean): Promise<boolean>;
  getSettings(): Promise<NotificationImportSettings>;
  setFeatureEnabled(enabled: boolean): Promise<boolean>;
  setReminderSettings(
    enabled: boolean,
    hour: number,
    minute: number,
  ): Promise<boolean>;
  setCaptureContext(
    profileId: string,
    householdId: string,
    canCreate: boolean,
    authorizationExpiresAt: string | null,
  ): Promise<boolean>;
  clearCaptureContext(): Promise<boolean>;
  listPending(): Promise<PendingNotificationTransaction[]>;
  updatePending(
    id: string,
    changes: Partial<
      Pick<
        PendingNotificationTransaction,
        "amount" | "currency" | "merchant" | "budgetAmount" | "budgetItemId"
      >
    >,
  ): Promise<boolean>;
  ignorePending(id: string): Promise<boolean>;
  markImported(id: string): Promise<boolean>;
  clearPending(): Promise<boolean>;
  getPendingCount(): Promise<number>;
  resetUnavailableStorage(): Promise<boolean>;
}

const nativeModule =
  Platform.OS === "android"
    ? requireOptionalNativeModule<NotificationExpenseImportNativeModule>(
        "HomeAppNotificationExpenseImport",
      )
    : null;

export const notificationExpenseImport = {
  available: Platform.OS === "android" && nativeModule !== null,
  clearCaptureContext: () => requireModule().clearCaptureContext(),
  clearPending: () => requireModule().clearPending(),
  getAccessStatus: () => requireModule().getAccessStatus(),
  getPendingCount: () => requireModule().getPendingCount(),
  getSettings: () => requireModule().getSettings(),
  getStorageState: () => requireModule().getStorageState(),
  ignorePending: (id: string) => requireModule().ignorePending(id),
  listDetectedSources: () => requireModule().listDetectedSources(),
  listPending: () => requireModule().listPending(),
  markImported: (id: string) => requireModule().markImported(id),
  openAccessSettings: () => requireModule().openAccessSettings(),
  openBackgroundSettings: () => requireModule().openBackgroundSettings(),
  refreshActiveNotifications: () =>
    requireModule().refreshActiveNotifications(),
  resetUnavailableStorage: () => requireModule().resetUnavailableStorage(),
  setCaptureContext: (
    profileId: string,
    householdId: string,
    canCreate: boolean,
    authorizationExpiresAt: string | null,
  ) =>
    requireModule().setCaptureContext(
      profileId,
      householdId,
      canCreate,
      authorizationExpiresAt,
    ),
  setFeatureEnabled: (enabled: boolean) =>
    requireModule().setFeatureEnabled(enabled),
  setReminderSettings: (enabled: boolean, hour: number, minute: number) =>
    requireModule().setReminderSettings(enabled, hour, minute),
  setSourceEnabled: (packageName: string, enabled: boolean) =>
    requireModule().setSourceEnabled(packageName, enabled),
  updatePending: (
    id: string,
    changes: Partial<
      Pick<
        PendingNotificationTransaction,
        "amount" | "currency" | "merchant" | "budgetAmount" | "budgetItemId"
      >
    >,
  ) => requireModule().updatePending(id, changes),
};

function requireModule(): NotificationExpenseImportNativeModule {
  if (!nativeModule) {
    throw new Error(
      Platform.OS === "android"
        ? "Natywny moduł importu wydatków nie jest dostępny w tym buildzie."
        : "Import wydatków z powiadomień jest dostępny tylko na Androidzie.",
    );
  }

  return nativeModule;
}

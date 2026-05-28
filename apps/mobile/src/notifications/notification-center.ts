import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";

const notificationHistoryKey = "homeapp.notificationHistory.v1";
const notificationDeletedIdsKey = "homeapp.notificationDeletedIds.v1";
const maxStoredNotifications = 40;
const maxDeletedNotificationIds = 120;

export type StoredNotification = {
  body: string;
  data?: Record<string, string>;
  id: string;
  receivedAt: string;
  status?: "read" | "unread";
  title: string;
};

export async function listStoredNotifications(): Promise<StoredNotification[]> {
  const deletedIds = await listDeletedNotificationIds();
  const raw = await SecureStore.getItemAsync(notificationHistoryKey);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as StoredNotification[];

    return Array.isArray(parsed)
      ? parsed.filter(
          (notification) =>
            !deletedIds.includes(notification.id) && shouldShowInNotificationCenter(notification),
        )
      : [];
  } catch {
    return [];
  }
}

export async function listUnreadStoredNotifications(): Promise<StoredNotification[]> {
  const notifications = await listStoredNotifications();

  return notifications.filter((notification) => (notification.status ?? "unread") === "unread");
}

export async function markStoredNotificationsRead(ids?: string[]): Promise<void> {
  const targetIds = ids ? new Set(ids) : null;
  const current = await listStoredNotifications();
  const next = current.map((notification) =>
    !targetIds || targetIds.has(notification.id)
      ? { ...notification, status: "read" as const }
      : notification,
  );

  await SecureStore.setItemAsync(notificationHistoryKey, JSON.stringify(next));
}

export async function clearStoredNotifications(): Promise<void> {
  const current = await listStoredNotifications();
  const deletedIds = await listDeletedNotificationIds();
  const nextDeletedIds = [...current.map((notification) => notification.id), ...deletedIds].slice(
    0,
    maxDeletedNotificationIds,
  );

  await SecureStore.setItemAsync(notificationDeletedIdsKey, JSON.stringify(nextDeletedIds));
  await SecureStore.setItemAsync(notificationHistoryKey, JSON.stringify([]));
}

export async function storeNotificationFromExpo(
  notification: Notifications.Notification,
): Promise<void> {
  const content = notification.request.content;
  const title = content.title?.trim() || "HomeApp";
  const body = content.body?.trim() || "";
  const deletedIds = await listDeletedNotificationIds();

  if (deletedIds.includes(notification.request.identifier)) {
    return;
  }

  if (isGenericHomeAppNotification(title, content.data)) {
    return;
  }

  await addStoredNotification({
    body,
    data: sanitizeNotificationData(content.data),
    id: notification.request.identifier,
    receivedAt: new Date().toISOString(),
    status: "unread",
    title,
  });
}

function shouldShowInNotificationCenter(notification: StoredNotification): boolean {
  return !isGenericHomeAppNotification(notification.title);
}

function isGenericHomeAppNotification(
  title: string,
  data?: Notifications.NotificationContent["data"],
): boolean {
  const normalizedTitle = title.trim().toLowerCase();
  const kind = typeof data?.kind === "string" ? data.kind : undefined;

  return normalizedTitle === "homeapp" || kind === "test";
}

async function addStoredNotification(notification: StoredNotification) {
  const current = await listStoredNotifications();
  const existing = current.find((item) => item.id === notification.id);
  const deduped = current.filter((item) => item.id !== notification.id);
  const next = [
    {
      ...notification,
      status: existing?.status ?? notification.status ?? "unread",
    },
    ...deduped,
  ].slice(0, maxStoredNotifications);

  await SecureStore.setItemAsync(notificationHistoryKey, JSON.stringify(next));
}

function sanitizeNotificationData(
  data: Notifications.NotificationContent["data"],
): Record<string, string> | undefined {
  if (!data) {
    return undefined;
  }

  const entries = Object.entries(data)
    .filter((entry): entry is [string, string | number | boolean] => {
      const value = entry[1];

      return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      );
    })
    .map(([key, value]) => [key, String(value)] as const);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

async function listDeletedNotificationIds(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(notificationDeletedIdsKey);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as string[];

    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";

const notificationHistoryKey = "homeapp.notificationHistory.v1";
const maxStoredNotifications = 40;

export type StoredNotification = {
  body: string;
  id: string;
  receivedAt: string;
  title: string;
};

export async function listStoredNotifications(): Promise<StoredNotification[]> {
  const raw = await SecureStore.getItemAsync(notificationHistoryKey);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as StoredNotification[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearStoredNotifications(): Promise<void> {
  await SecureStore.deleteItemAsync(notificationHistoryKey);
}

export async function storeNotificationFromExpo(
  notification: Notifications.Notification,
): Promise<void> {
  const content = notification.request.content;
  const title = content.title?.trim() || "HomeApp";
  const body = content.body?.trim() || "";

  await addStoredNotification({
    body,
    id: notification.request.identifier,
    receivedAt: new Date().toISOString(),
    title,
  });
}

async function addStoredNotification(notification: StoredNotification) {
  const current = await listStoredNotifications();
  const deduped = current.filter((item) => item.id !== notification.id);
  const next = [notification, ...deduped].slice(0, maxStoredNotifications);

  await SecureStore.setItemAsync(notificationHistoryKey, JSON.stringify(next));
}

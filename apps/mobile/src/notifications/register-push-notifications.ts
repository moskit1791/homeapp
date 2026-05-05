import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken, type PushPlatform } from "../api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowAlert: true,
  }),
});

export async function registerForPushNotifications(accessToken: string): Promise<string | null> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      importance: Notifications.AndroidImportance.DEFAULT,
      name: "Domyślne",
    });
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermission.status;

  if (finalStatus !== "granted") {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission.status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId = readExpoProjectId();

  if (!projectId) {
    console.warn("EXPO_PROJECT_ID is required to register push notifications.");
    return null;
  }

  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  await registerPushToken(
    {
      deviceName: readDeviceName(),
      expoPushToken,
      platform: normalizePushPlatform(Platform.OS),
    },
    { accessToken },
  );

  return expoPushToken;
}

function readExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string }; projectId?: string }
    | undefined;
  const constantsWithEas = Constants as { easConfig?: { projectId?: string } };

  return constantsWithEas.easConfig?.projectId ?? extra?.eas?.projectId ?? extra?.projectId;
}

function readDeviceName(): string | undefined {
  return (Constants as { deviceName?: string }).deviceName;
}

function normalizePushPlatform(platform: string): PushPlatform {
  if (platform === "android" || platform === "ios" || platform === "web") {
    return platform;
  }

  return "unknown";
}

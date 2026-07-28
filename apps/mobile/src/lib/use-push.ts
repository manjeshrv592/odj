import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useSession } from "./auth-client";
import { appApi } from "./app-api";

// Show notifications while the app is foregrounded (banner + list + sound).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Ask permission, get this device's Expo push token, and register it with the backend. */
async function registerForPushAsync(): Promise<void> {
  // Push tokens are only issued on physical devices (not simulators/emulators).
  if (!Device.isDevice) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return; // user declined — nothing to register

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as
    | string
    | undefined;
  if (!projectId) return;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await appApi.registerPushToken(
    token,
    Platform.OS as "ios" | "android" | "web",
  );
}

/**
 * Registers this device's Expo push token with the backend once a session exists.
 * Best-effort — failures (permission denied, emulator, offline) are swallowed and
 * retried on the next mount.
 */
export function usePushRegistration(): void {
  const { data: session } = useSession();
  const done = useRef(false);

  useEffect(() => {
    if (!session?.user || done.current) return;
    done.current = true;
    registerForPushAsync().catch(() => {
      done.current = false; // allow a retry on the next mount
    });
  }, [session?.user]);
}

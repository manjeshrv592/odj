import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useRouter, type Href } from "expo-router";
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

/**
 * Where to route a tapped notification. `type` rides along in every push's
 * `data` (see `notifyUser`/`pushUser` on the backend). Keyed by type so more
 * job events can route somewhere later — today `job_completed` (prompt the
 * hirer to rate the worker) and `chat_message` (open that job's chat, for
 * either role) have a destination.
 */
function routeForNotification(
  data: Record<string, unknown> | undefined,
  userType: string | null | undefined,
): Href | null {
  const jobId = typeof data?.jobId === "string" ? data.jobId : undefined;
  const type = typeof data?.type === "string" ? data.type : undefined;
  if (!jobId) return null;
  if (type === "job_completed" && userType === "hirer") {
    return `/(hirer)/rate-job?jobId=${jobId}` as Href;
  }
  if (type === "chat_message") {
    return userType === "worker"
      ? (`/(worker)/chat?jobId=${jobId}` as Href)
      : userType === "hirer"
        ? (`/(hirer)/chat?jobId=${jobId}` as Href)
        : null;
  }
  return null;
}

/**
 * Route a tapped push notification to the right screen — handles both a tap
 * while the app is backgrounded and the cold-start case (app launched by
 * tapping a notification from killed). `userType` decides which role's routes
 * to target (a push's `data` alone doesn't say who's reading it).
 */
export function useNotificationTapRouting(
  userType: string | null | undefined,
): void {
  const router = useRouter();

  const handleResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const href = routeForNotification(data, userType);
      if (href) router.push(href);
    },
    [router, userType],
  );

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  }, [handleResponse]);
}

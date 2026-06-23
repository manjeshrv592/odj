import { env } from "../env";

/**
 * Minimal Expo push sender. Posts directly to the Expo Push API over HTTPS — no
 * SDK dependency. Best-effort: failures are logged, never thrown, so a push
 * problem can't break the request that triggered it (approve/reject still
 * persist + email + create the in-app notification).
 *
 * @see https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** An Expo push token looks like `ExponentPushToken[…]` / `ExpoPushToken[…]`. */
function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

/**
 * Send one message to many Expo push tokens (chunked at the API's 100-per-request
 * limit). Invalid-looking tokens are skipped. Resolves even on transport errors.
 */
export async function sendExpoPush(
  tokens: string[],
  msg: PushMessage,
): Promise<void> {
  const valid = [...new Set(tokens)].filter(isExpoPushToken);
  if (valid.length === 0) return;

  for (let i = 0; i < valid.length; i += 100) {
    const chunk = valid.slice(i, i + 100);
    const messages = chunk.map((to) => ({
      to,
      title: msg.title,
      body: msg.body,
      ...(msg.data ? { data: msg.data } : {}),
      sound: "default" as const,
    }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        console.warn(`[push] Expo push failed: ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      const label = `${chunk.length} token(s)`;
      if (env.NODE_ENV !== "production") {
        console.warn(`[push] send failed (${(err as Error).message}) for ${label}`);
      } else {
        console.error(`[push] send failed for ${label}`, err);
      }
    }
  }
}

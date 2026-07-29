import { eq } from "drizzle-orm";
import type { NotificationType } from "@odj/shared";
import { db } from "../db";
import { notifications, pushTokens } from "../db/schema";
import { sendExpoPush } from "./push";

/**
 * Notification fan-out for worker/hirer users. `createNotification` persists the
 * in-app row (read by the mobile notifications list); `notifyUser` additionally
 * pushes to the user's registered devices. Email is sent separately by the
 * caller (copy differs per decision).
 */

interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Persist a single in-app notification for a user. */
export async function createNotification(
  userId: string,
  input: NotificationInput,
): Promise<void> {
  await db.insert(notifications).values({
    userId,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data ?? null,
  });
}

/**
 * Push to every device the user has registered — **without** persisting an in-app
 * row. For transient, real-time events (job offers/status) that are surfaced by
 * live screens + the job lists, so the notifications list stays uncluttered.
 */
export async function pushUser(
  userId: string,
  input: NotificationInput,
): Promise<void> {
  const tokens = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(eq(pushTokens.userId, userId));

  await sendExpoPush(
    tokens.map((t) => t.token),
    {
      title: input.title,
      body: input.body,
      // `type` rides along in `data` (not just this call's payload) so the client
      // can route a notification tap without a separate lookup — see mobile's
      // `useNotificationTapRouting`.
      data: { ...input.data, type: input.type },
    },
  );
}

/**
 * Create the in-app notification *and* push to every device the user has
 * registered. Push is best-effort (see `sendExpoPush`). Use for account notices
 * (verification decisions) that belong in the persistent notifications list.
 */
export async function notifyUser(
  userId: string,
  input: NotificationInput,
): Promise<void> {
  await createNotification(userId, input);
  await pushUser(userId, input);
}

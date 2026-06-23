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
 * Create the in-app notification *and* push to every device the user has
 * registered. Push is best-effort (see `sendExpoPush`).
 */
export async function notifyUser(
  userId: string,
  input: NotificationInput,
): Promise<void> {
  await createNotification(userId, input);

  const tokens = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(eq(pushTokens.userId, userId));

  await sendExpoPush(
    tokens.map((t) => t.token),
    { title: input.title, body: input.body, data: input.data },
  );
}

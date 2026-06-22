import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { user } from "./schema";
import { env } from "../env";

/**
 * Ensure the bootstrap super-admin exists. Idempotent — safe to run on every
 * backend start:
 *
 * - No user with `ROOT_USER_EMAIL` → create one as `userType:"admin"`,
 *   `adminRole:"root"` (pending: not email-verified, onboarding incomplete).
 *   They become fully active on their first email-OTP sign-in.
 * - User exists but isn't the root admin → promote them (set userType/adminRole).
 * - Already root → no-op.
 *
 * Non-fatal: a failure here is logged but does not prevent the server from
 * starting (e.g. transient DB issue), so health/readiness stays meaningful.
 */
export async function seedRootAdmin(): Promise<void> {
  const email = env.ROOT_USER_EMAIL.toLowerCase().trim();

  try {
    const [existing] = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (!existing) {
      await db.insert(user).values({
        id: randomUUID(),
        name: "Root Admin",
        email,
        emailVerified: false,
        userType: "admin",
        adminRole: "root",
        onboardingCompleted: false,
      });
      console.log(`[seed] root admin created: ${email}`);
      return;
    }

    if (existing.userType !== "admin" || existing.adminRole !== "root") {
      await db
        .update(user)
        .set({ userType: "admin", adminRole: "root", updatedAt: new Date() })
        .where(eq(user.id, existing.id));
      console.log(`[seed] root admin promoted: ${email}`);
      return;
    }

    console.log(`[seed] root admin present: ${email}`);
  } catch (err) {
    console.error(
      `[seed] failed to ensure root admin (${email}): ${(err as Error).message}`,
    );
  }
}

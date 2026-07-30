/**
 * Demo seed — populates a *demo/staging* database so the app has something to
 * show: a real catalog (categories → professions with admin price bounds) and a
 * pool of approved, online workers a hirer search can actually match against.
 *
 * Without this, a stakeholder walking through the app lands on empty category
 * lists and every search returns "no workers", which reads as broken rather
 * than as empty.
 *
 * **Idempotent** — safe to re-run; keyed on category/profession slug and user
 * email, so it tops up rather than duplicating.
 *
 * Run:  pnpm --filter @odj/backend db:seed-demo
 *
 * NOTE: `avgRating` / `ratingCount` on the demo workers are set directly for
 * display purposes; there are no matching rows in `ratings`, because a real
 * rating requires a completed job. Real ratings written through the app stay
 * consistent — see the rating submit endpoint, which updates both in one
 * transaction.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/index.js";
import {
  categories,
  professions,
  workerProfiles,
  workerProfessions,
  workerProfessionRates,
  hirerProfiles,
} from "../src/db/schema.js";
import { user } from "../src/db/auth-schema.js";

/** Bangalore city centre — demo workers are scattered inside the 15 km search radius. */
const CENTRE = { lat: 12.9716, lng: 77.5946 };

/** Offset a coordinate by roughly `km` in a deterministic direction. */
function near(index: number, km: number) {
  const angle = (index * 137.5 * Math.PI) / 180; // golden-angle scatter
  const dLat = (km / 111) * Math.cos(angle);
  const dLng = (km / (111 * Math.cos((CENTRE.lat * Math.PI) / 180))) * Math.sin(angle);
  return { lat: CENTRE.lat + dLat, lng: CENTRE.lng + dLng };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Catalog: category → professions, each with admin daily/hourly ₹ bounds.
 *  A unit is only bookable when BOTH its min and max are set. Some professions
 *  deliberately offer only one unit, to exercise that path in the booking UI. */
const CATALOG: Array<{
  name: string;
  description: string;
  professions: Array<{
    name: string;
    daily?: [number, number];
    hourly?: [number, number];
  }>;
}> = [
  {
    name: "Driver",
    description: "Personal, commercial and heavy-vehicle drivers.",
    professions: [
      { name: "Cab Driver", daily: [800, 1800], hourly: [120, 300] },
      { name: "Personal Driver", daily: [900, 2000], hourly: [150, 350] },
      { name: "Truck Driver", daily: [1200, 2800] }, // daily only
    ],
  },
  {
    name: "Security",
    description: "Guards and bouncers for homes, events and venues.",
    professions: [
      { name: "Security Guard", daily: [700, 1500], hourly: [100, 250] },
      { name: "Bouncer", daily: [1500, 3500], hourly: [250, 600] },
    ],
  },
  {
    name: "Domestic Help",
    description: "Housekeeping, cleaning and childcare.",
    professions: [
      { name: "Maid", daily: [500, 1200], hourly: [80, 200] },
      { name: "Nanny", daily: [800, 1800], hourly: [120, 280] },
      { name: "Deep Cleaner", hourly: [150, 400] }, // hourly only
    ],
  },
  {
    name: "Cook",
    description: "Home cooks and party catering staff.",
    professions: [
      { name: "Home Cook", daily: [700, 1600], hourly: [120, 300] },
      { name: "Party Chef", daily: [2000, 5000], hourly: [400, 900] },
    ],
  },
  {
    name: "Electrician",
    description: "Wiring, repairs and appliance installation.",
    professions: [{ name: "Electrician", hourly: [200, 500], daily: [1000, 2500] }],
  },
  {
    name: "Plumber",
    description: "Leaks, fittings and bathroom work.",
    professions: [{ name: "Plumber", hourly: [200, 500], daily: [1000, 2400] }],
  },
];

/** Demo workers. `email` drives login: a Gmail +alias delivers to the same inbox,
 *  so the two `manjeshrv592+…` accounts CAN receive a real OTP and be signed
 *  into for a genuine two-sided walkthrough. The rest use an unroutable domain —
 *  they exist as searchable supply, not as accounts anyone logs into. */
const WORKERS: Array<{
  email: string;
  first: string;
  last: string;
  professions: string[];
  rating?: [number, number]; // [avg, count]
}> = [
  { email: "manjeshrv592+worker@gmail.com", first: "Demo", last: "Worker", professions: ["cab-driver", "personal-driver"], rating: [4.8, 24] },
  { email: "demo.ravi@odj.invalid", first: "Ravi", last: "Kumar", professions: ["cab-driver", "truck-driver"], rating: [4.6, 41] },
  { email: "demo.suresh@odj.invalid", first: "Suresh", last: "Naik", professions: ["security-guard", "bouncer"], rating: [4.9, 17] },
  { email: "demo.lakshmi@odj.invalid", first: "Lakshmi", last: "Devi", professions: ["maid", "deep-cleaner"], rating: [4.7, 63] },
  { email: "demo.anita@odj.invalid", first: "Anita", last: "Rao", professions: ["home-cook", "nanny"], rating: [4.5, 12] },
  { email: "demo.imran@odj.invalid", first: "Imran", last: "Shaikh", professions: ["electrician", "plumber"], rating: [4.4, 33] },
  { email: "demo.gopal@odj.invalid", first: "Gopal", last: "Reddy", professions: ["personal-driver", "security-guard"] },
];

/** Pick a rate inside the admin bounds — ~40% up the range, so it's clearly
 *  neither the floor nor the ceiling. */
const rateIn = ([min, max]: [number, number]) => Math.round(min + (max - min) * 0.4);

async function ensureUser(email: string, first: string, last: string, userType: "worker" | "hirer") {
  const [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      name: `${first} ${last}`,
      email,
      emailVerified: true,
      userType,
      onboardingCompleted: true,
      firstName: first,
      lastName: last,
    })
    .returning();
  return created!;
}

async function main() {
  let catCount = 0;
  let profCount = 0;
  const profBySlug = new Map<string, { id: string; daily?: [number, number]; hourly?: [number, number] }>();

  // ── Catalog ────────────────────────────────────────────────────────────────
  for (const c of CATALOG) {
    const cSlug = slug(c.name);
    let [cat] = await db.select().from(categories).where(eq(categories.slug, cSlug)).limit(1);
    if (!cat) {
      [cat] = await db
        .insert(categories)
        .values({ name: c.name, slug: cSlug, description: c.description, isActive: true })
        .returning();
      catCount++;
    }
    for (const [i, p] of c.professions.entries()) {
      const pSlug = slug(p.name);
      let [prof] = await db
        .select()
        .from(professions)
        .where(and(eq(professions.categoryId, cat!.id), eq(professions.slug, pSlug)))
        .limit(1);
      if (!prof) {
        [prof] = await db
          .insert(professions)
          .values({
            categoryId: cat!.id,
            name: p.name,
            slug: pSlug,
            position: i,
            isActive: true,
            dailyMin: p.daily?.[0] ?? null,
            dailyMax: p.daily?.[1] ?? null,
            hourlyMin: p.hourly?.[0] ?? null,
            hourlyMax: p.hourly?.[1] ?? null,
          })
          .returning();
        profCount++;
      }
      profBySlug.set(pSlug, { id: prof!.id, daily: p.daily, hourly: p.hourly });
    }
  }

  // ── Workers ────────────────────────────────────────────────────────────────
  let workerCount = 0;
  for (const [i, w] of WORKERS.entries()) {
    const u = await ensureUser(w.email, w.first, w.last, "worker");
    const pos = near(i, 2 + (i % 5) * 2.5); // 2–12 km out, inside the 15 km radius
    let [wp] = await db.select().from(workerProfiles).where(eq(workerProfiles.userId, u.id)).limit(1);
    if (!wp) {
      [wp] = await db
        .insert(workerProfiles)
        .values({
          userId: u.id,
          firstName: w.first,
          lastName: w.last,
          city: "Bengaluru",
          state: "Karnataka",
          lat: pos.lat,
          lng: pos.lng,
          locationAccuracy: 12,
          locationCapturedAt: new Date(),
          languages: ["English", "Hindi", "Kannada"],
          status: "approved",
          submittedAt: new Date(),
          reviewedAt: new Date(),
          setupCompletedAt: new Date(),
          availabilityReviewedAt: new Date(),
          isOnline: true, // only online workers receive offers
          lastOnlineAt: new Date(),
          avgRating: w.rating?.[0] ?? null,
          ratingCount: w.rating?.[1] ?? 0,
        })
        .returning();
      workerCount++;
    }
    for (const pSlug of w.professions) {
      const p = profBySlug.get(pSlug);
      if (!p) continue;
      await db
        .insert(workerProfessions)
        .values({ workerProfileId: wp!.id, professionId: p.id })
        .onConflictDoNothing();
      await db
        .insert(workerProfessionRates)
        .values({
          workerProfileId: wp!.id,
          professionId: p.id,
          dailyRate: p.daily ? rateIn(p.daily) : null,
          hourlyRate: p.hourly ? rateIn(p.hourly) : null,
        })
        .onConflictDoNothing();
    }
  }

  // ── A hirer, so workers have a counterpart profile to view ─────────────────
  const hu = await ensureUser("manjeshrv592+hirer@gmail.com", "Demo", "Hirer", "hirer");
  const [existingHirer] = await db
    .select()
    .from(hirerProfiles)
    .where(eq(hirerProfiles.userId, hu.id))
    .limit(1);
  let hirerCreated = false;
  if (!existingHirer) {
    await db.insert(hirerProfiles).values({
      userId: hu.id,
      firstName: "Demo",
      lastName: "Hirer",
      city: "Bengaluru",
      state: "Karnataka",
      lat: CENTRE.lat,
      lng: CENTRE.lng,
      hirerType: "individual",
      status: "approved",
      submittedAt: new Date(),
      reviewedAt: new Date(),
      avgRating: 4.7,
      ratingCount: 9,
    });
    hirerCreated = true;
  }

  console.log(
    [
      "[seed-demo] done",
      `  categories  +${catCount} (of ${CATALOG.length})`,
      `  professions +${profCount} (of ${CATALOG.reduce((n, c) => n + c.professions.length, 0)})`,
      `  workers     +${workerCount} (of ${WORKERS.length}) — approved, online, rates set`,
      `  hirer       ${hirerCreated ? "+1" : "already present"}`,
      "",
      "  Loginable demo accounts (OTP lands in the same Gmail inbox):",
      "    worker → manjeshrv592+worker@gmail.com",
      "    hirer  → manjeshrv592+hirer@gmail.com",
    ].join("\n"),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("[seed-demo] failed:", e);
  process.exit(1);
});

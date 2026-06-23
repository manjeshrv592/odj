import { z } from "zod";

/**
 * Core domain primitives for the ODJ hiring platform.
 *
 * This file is the **single source of truth** for cross-cutting domain types
 * (roles, approval state, categories, …). Backend validation, web forms, and
 * mobile forms all import from here so the same constraints apply everywhere.
 *
 * It is intentionally minimal for now; it grows as features are built. Where a
 * table is owned by the backend (Drizzle), prefer generating its zod schema via
 * `drizzle-zod` and re-exporting refined versions here.
 */

/**
 * Who a user is on the platform — their marketplace identity.
 *
 * - `worker` / `hirer` are mobile-app users.
 * - `admin` are web-portal users (invite-only).
 *
 * Stored on the better-auth `user` row as the `userType` additional field
 * (nullable until a mobile user picks "Work" or "Hire" during onboarding).
 */
export const userTypeSchema = z.enum(["worker", "hirer", "admin"]);
export type UserType = z.infer<typeof userTypeSchema>;

/** Back-compat alias for {@link userTypeSchema}. */
export const userRoleSchema = userTypeSchema;
export type UserRole = UserType;

/**
 * Admin sub-role for web-portal users (only meaningful when
 * `userType === "admin"`). `root` is the bootstrap super-admin seeded from
 * `ROOT_USER_EMAIL`; `admin` are invited operators. Both may manage portal users.
 */
export const adminRoleSchema = z.enum(["root", "admin"]);
export type AdminRole = z.infer<typeof adminRoleSchema>;

/** Admin approval lifecycle for worker/hirer profiles and submitted documents. */
export const approvalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

/**
 * Convert an arbitrary display name into a kebab-case slug. Pure and dependency
 * free so it can run anywhere (backend, web). Strips accents, lowercases, turns
 * any run of non-alphanumerics into a single dash, and trims leading/trailing
 * dashes. The backend layers uniqueness (suffixing `-2`, `-3`, …) on top.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Catalog → Categories → Professions ───────────────────────────────────────

/** Reusable kebab-case slug field (server-generated; clients only read it). */
const slugFieldSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "slug must be kebab-case");

/**
 * A working domain/category an admin defines (e.g. "Driver", "Bouncer", "Maid").
 * A Category is a group of Professions and carries an icon image (Uploadcare CDN
 * url). `slug` is auto-generated from `name` server-side; `isActive` toggles
 * visibility without deleting.
 */
export const categorySchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(80),
  slug: slugFieldSchema,
  description: z.string().max(500).nullish(),
  image: z.url().nullish(),
  isActive: z.boolean().default(true),
});
export type Category = z.infer<typeof categorySchema>;

/** Create a category (server generates `id` + `slug`, sets `isActive`). */
export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).nullish(),
  image: z.url().nullish(),
});
export type CreateCategory = z.infer<typeof createCategorySchema>;

/** Update a category. All fields optional; `slug` re-derives when `name` changes. */
export const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).nullish(),
  image: z.url().nullish(),
  isActive: z.boolean().optional(),
});
export type UpdateCategory = z.infer<typeof updateCategorySchema>;

/**
 * A Profession belongs to exactly one Category (e.g. "Cab Driver" under
 * "Driver"). Name + auto slug only (no icon). `position` orders professions
 * within their category.
 */
export const professionSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  name: z.string().min(2).max(80),
  slug: slugFieldSchema,
  isActive: z.boolean().default(true),
  position: z.number().int(),
});
export type Profession = z.infer<typeof professionSchema>;

/** Create a profession (category comes from the route; server makes id + slug). */
export const createProfessionSchema = z.object({
  name: z.string().trim().min(2).max(80),
});
export type CreateProfession = z.infer<typeof createProfessionSchema>;

/** Update a profession. `position` is used for reordering within the category. */
export const updateProfessionSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  isActive: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateProfession = z.infer<typeof updateProfessionSchema>;

// ── Requirement fields (cascading worker questions) ──────────────────────────

/**
 * The three levels a requirement field attaches to, which cascade onto a
 * profession's effective set: `catalog` (all workers) → `category` (all
 * professions in it) → `profession` (that one only).
 */
export const requirementLevelSchema = z.enum([
  "catalog",
  "category",
  "profession",
]);
export type RequirementLevel = z.infer<typeof requirementLevelSchema>;

/** Input type a worker uses to answer a requirement field (for now). */
export const requirementInputTypeSchema = z.enum(["text", "file", "select"]);
export type RequirementInputType = z.infer<typeof requirementInputTypeSchema>;

/** File types an admin may allow for a `file` requirement field. */
export const allowedFileTypeSchema = z.enum(["pdf", "jpg", "jpeg", "png"]);
export type AllowedFileType = z.infer<typeof allowedFileTypeSchema>;

/** A selectable option for a `select` requirement field. */
export const requirementOptionSchema = z.object({
  value: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
});
export type RequirementOption = z.infer<typeof requirementOptionSchema>;

/**
 * A single admin-authored question/document a worker provides. `key` is a
 * stable, immutable identifier (generated once from the label) that future
 * worker answers map to — editing `label` never changes it. `options` is set
 * only for `select`, `allowedFileTypes` only for `file`.
 */
export const requirementFieldSchema = z.object({
  id: z.uuid(),
  level: requirementLevelSchema,
  categoryId: z.uuid().nullish(),
  professionId: z.uuid().nullish(),
  key: z.string(),
  label: z.string().min(1).max(160),
  inputType: requirementInputTypeSchema,
  required: z.boolean().default(false),
  options: z.array(requirementOptionSchema).nullish(),
  allowedFileTypes: z.array(allowedFileTypeSchema).nullish(),
  position: z.number().int(),
  isActive: z.boolean().default(true),
});
export type RequirementField = z.infer<typeof requirementFieldSchema>;

/**
 * Shared shape of the writable parts of a requirement field, with cross-field
 * rules: a `select` needs ≥1 option; a `file` needs ≥1 allowed file type; the
 * `level` must match which target id is supplied (catalog → none, category →
 * categoryId, profession → professionId).
 */
const requirementFieldBody = z.object({
  level: requirementLevelSchema,
  categoryId: z.uuid().nullish(),
  professionId: z.uuid().nullish(),
  label: z.string().trim().min(1).max(160),
  inputType: requirementInputTypeSchema,
  required: z.boolean().default(false),
  options: z.array(requirementOptionSchema).max(50).optional(),
  allowedFileTypes: z.array(allowedFileTypeSchema).optional(),
});

function refineRequirementBody(
  data: z.infer<typeof requirementFieldBody>,
  ctx: z.RefinementCtx,
): void {
  if (data.inputType === "select" && (data.options?.length ?? 0) === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["options"],
      message: "Add at least one option for a dropdown field",
    });
  }
  if (
    data.inputType === "file" &&
    (data.allowedFileTypes?.length ?? 0) === 0
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["allowedFileTypes"],
      message: "Pick at least one allowed file type",
    });
  }
  if (data.level === "catalog" && (data.categoryId || data.professionId)) {
    ctx.addIssue({
      code: "custom",
      path: ["level"],
      message: "Catalog-level fields must not target a category or profession",
    });
  }
  if (data.level === "category" && !data.categoryId) {
    ctx.addIssue({
      code: "custom",
      path: ["categoryId"],
      message: "Category-level fields require a categoryId",
    });
  }
  if (data.level === "profession" && !data.professionId) {
    ctx.addIssue({
      code: "custom",
      path: ["professionId"],
      message: "Profession-level fields require a professionId",
    });
  }
}

/** Create a requirement field (server makes id + stable `key` + position). */
export const createRequirementFieldSchema =
  requirementFieldBody.superRefine(refineRequirementBody);
export type CreateRequirementField = z.infer<
  typeof createRequirementFieldSchema
>;

/**
 * Update a requirement field. Level/target are fixed once created, so only the
 * editable parts are accepted; `position` supports reordering within the scope.
 * `key` is intentionally absent — it is immutable.
 */
export const updateRequirementFieldSchema = z
  .object({
    label: z.string().trim().min(1).max(160).optional(),
    inputType: requirementInputTypeSchema.optional(),
    required: z.boolean().optional(),
    options: z.array(requirementOptionSchema).max(50).nullish(),
    allowedFileTypes: z.array(allowedFileTypeSchema).nullish(),
    isActive: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.inputType === "select" && (data.options?.length ?? 0) === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Add at least one option for a dropdown field",
      });
    }
    if (
      data.inputType === "file" &&
      (data.allowedFileTypes?.length ?? 0) === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["allowedFileTypes"],
        message: "Pick at least one allowed file type",
      });
    }
  });
export type UpdateRequirementField = z.infer<
  typeof updateRequirementFieldSchema
>;

/**
 * A profession's effective requirement set, grouped by source so the admin UI
 * (and later the mobile worker flow) can show inherited vs own fields. Each
 * group is ordered by `position`.
 */
export const effectiveRequirementsSchema = z.object({
  catalog: z.array(requirementFieldSchema),
  category: z.array(requirementFieldSchema),
  profession: z.array(requirementFieldSchema),
});
export type EffectiveRequirements = z.infer<typeof effectiveRequirementsSchema>;

/** Email used for OTP login. Normalised to lowercase. */
export const emailSchema = z
  .email()
  .transform((v) => v.toLowerCase().trim());

/** A 6-digit one-time passcode. */
export const otpSchema = z.string().regex(/^\d{6}$/, "OTP must be 6 digits");

/**
 * Contact phone number, stored as-is (no SMS/OTP verification yet — that lands
 * with DLT). Lenient: allows a leading `+`, digits, spaces, dashes, parentheses.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(20, "Phone number is too long")
  .regex(/^\+?[\d\s()-]+$/, "Enter a valid phone number");

// ── Identity / onboarding ────────────────────────────────────────────────────

/**
 * App-facing view of the authenticated user, projecting the better-auth `user`
 * row plus ODJ's additional fields. Clients read this off the session; the
 * `userType`/`adminRole`/`onboardingCompleted` fields drive routing and access.
 */
export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullish(),
  userType: userTypeSchema.nullish(),
  adminRole: adminRoleSchema.nullish(),
  onboardingCompleted: z.boolean().default(false),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  phone: z.string().nullish(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

// ── Admin profile (onboarding wizard + profile page) ─────────────────────────

/**
 * Partial update of an admin's own profile (name / phone / avatar). Used by the
 * Profile page; `name` is derived server-side as "first last". Email is NOT here
 * — it changes via the OTP flow (better-auth emailOTP `changeEmail`).
 */
export const adminProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  phone: phoneSchema.optional(),
  image: z.url().nullish(),
});
export type AdminProfileUpdate = z.infer<typeof adminProfileUpdateSchema>;

/**
 * Wizard finish payload: completes admin onboarding in one shot. First/last name
 * and phone are required; avatar is optional (the step is skippable). The server
 * derives `name` and flips `onboardingCompleted` to true.
 */
export const completeOnboardingSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  phone: phoneSchema,
  image: z.url().nullish(),
});
export type CompleteOnboarding = z.infer<typeof completeOnboardingSchema>;

// ── Admin portal users (invite-only) ─────────────────────────────────────────

/** Invite a new admin to the web portal. Email only — the rest is filled later. */
export const inviteAdminSchema = z.object({
  email: emailSchema,
});
export type InviteAdmin = z.infer<typeof inviteAdminSchema>;

/** A portal (admin) user as listed in the admin "Portal users" table. */
export const portalUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  adminRole: adminRoleSchema,
  onboardingCompleted: z.boolean(),
  emailVerified: z.boolean(),
  createdAt: z.coerce.date(),
});
export type PortalUser = z.infer<typeof portalUserSchema>;

// ── Worker / Hirer onboarding (mobile) ───────────────────────────────────────

/**
 * Lifecycle of a worker/hirer profile collected in the mobile onboarding wizard.
 * `draft` while the multi-step wizard is in progress (resumable per step);
 * `under_review` after final submit (awaiting admin approval — a later feature);
 * `approved` / `rejected` are the eventual admin-decision outcomes.
 */
export const profileStatusSchema = z.enum([
  "draft",
  "under_review",
  "approved",
  "rejected",
]);
export type ProfileStatus = z.infer<typeof profileStatusSchema>;

/**
 * Curated languages a worker can speak, shown as a multi-select in onboarding.
 * Static for now (English + major Indian languages); may move to an admin-managed
 * catalog later. `code` is the stored value, `label` the UI text.
 */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "bn", label: "Bengali" },
  { code: "te", label: "Telugu" },
  { code: "mr", label: "Marathi" },
  { code: "ta", label: "Tamil" },
  { code: "ur", label: "Urdu" },
  { code: "gu", label: "Gujarati" },
  { code: "kn", label: "Kannada" },
  { code: "or", label: "Odia" },
  { code: "ml", label: "Malayalam" },
  { code: "pa", label: "Punjabi" },
  { code: "as", label: "Assamese" },
  { code: "mai", label: "Maithili" },
  { code: "sat", label: "Santali" },
  { code: "ks", label: "Kashmiri" },
  { code: "ne", label: "Nepali" },
  { code: "kok", label: "Konkani" },
  { code: "sd", label: "Sindhi" },
] as const;

/** A valid language code from {@link LANGUAGES}. */
export const languageCodeSchema = z.enum(
  LANGUAGES.map((l) => l.code) as [string, ...string[]],
);
export type LanguageCode = (typeof LANGUAGES)[number]["code"];

/**
 * Indian GSTIN — 15 chars: 2-digit state code, 10-char PAN, 1 entity digit, a
 * fixed `Z`, and 1 checksum char. Normalised to uppercase before validating.
 */
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/,
    "Enter a valid 15-character GSTIN",
  );

/** Whether a hirer is an individual or a registered business. */
export const hirerTypeSchema = z.enum(["individual", "business"]);
export type HirerType = z.infer<typeof hirerTypeSchema>;

/** Legal organisation type for a business hirer (optional at onboarding). */
export const orgTypeSchema = z.enum([
  "pvt_ltd",
  "llp",
  "partnership",
  "proprietorship",
  "other",
]);
export type OrgType = z.infer<typeof orgTypeSchema>;

/**
 * A worker's answers to the cascaded requirement fields, keyed by each field's
 * stable `key`. Text/select answers are a string; multi-value answers are a
 * string[]; file answers store the uploaded CDN url string. The set of expected
 * keys is dynamic (depends on the chosen professions), so completeness/required
 * validation happens server-side against the effective field set at submit time.
 */
export const requirementAnswerValueSchema = z.union([
  z.string(),
  z.array(z.string()),
]);
export const requirementAnswersSchema = z.record(
  z.string(),
  requirementAnswerValueSchema,
);
export type RequirementAnswers = z.infer<typeof requirementAnswersSchema>;

// ── Shared onboarding step payloads ──────────────────────────────────────────

/** Name step — shared by worker & hirer wizards. */
export const nameStepSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
});
export type NameStep = z.infer<typeof nameStepSchema>;

/** Profile-photo step — stores the uploaded Uploadcare CDN url. */
export const photoStepSchema = z.object({ photoUrl: z.url() });
export type PhotoStep = z.infer<typeof photoStepSchema>;

/** City/State step — autodetected (with lat/lng) or entered manually. */
export const locationStepSchema = z.object({
  city: z.string().trim().min(1, "City is required").max(120),
  state: z.string().trim().min(1, "State is required").max(120),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
});
export type LocationStep = z.infer<typeof locationStepSchema>;

// ── Worker onboarding ────────────────────────────────────────────────────────

/** Skills step — one or more professions from the catalog. */
export const workerSkillsStepSchema = z.object({
  professionIds: z.array(z.uuid()).min(1, "Pick at least one profession"),
});
export type WorkerSkillsStep = z.infer<typeof workerSkillsStepSchema>;

/** Languages step — one or more curated languages. */
export const workerLanguagesStepSchema = z.object({
  languages: z.array(languageCodeSchema).min(1, "Pick at least one language"),
});
export type WorkerLanguagesStep = z.infer<typeof workerLanguagesStepSchema>;

/** Requirement-fields step — answers keyed by stable field `key`. */
export const workerRequirementsStepSchema = z.object({
  answers: requirementAnswersSchema,
});
export type WorkerRequirementsStep = z.infer<
  typeof workerRequirementsStepSchema
>;

/**
 * Partial per-step save for a worker draft (PATCH /api/app/worker-profile).
 * Every field optional; `currentStep` advances the resumable wizard cursor.
 * (Professions are saved via PUT /worker-profile/professions, not here.)
 */
export const workerProfileUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(60).optional(),
    lastName: z.string().trim().min(1).max(60).optional(),
    photoUrl: z.url().nullish(),
    city: z.string().trim().min(1).max(120).optional(),
    state: z.string().trim().min(1).max(120).optional(),
    lat: z.number().min(-90).max(90).nullish(),
    lng: z.number().min(-180).max(180).nullish(),
    languages: z.array(languageCodeSchema).optional(),
    answers: requirementAnswersSchema.optional(),
    currentStep: z.number().int().min(0).max(20).optional(),
  })
  .strict();
export type WorkerProfileUpdate = z.infer<typeof workerProfileUpdateSchema>;

/**
 * Static-field validation applied at worker submit (dynamic requirement answers
 * + ≥1 profession are checked server-side against the effective field set).
 */
export const workerSubmitSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  photoUrl: z.url("A profile photo is required"),
  city: z.string().trim().min(1, "City is required").max(120),
  state: z.string().trim().min(1, "State is required").max(120),
  languages: z.array(languageCodeSchema).min(1, "Pick at least one language"),
});

/** Full worker profile as returned by GET /api/app/me. */
export const workerProfileSchema = z.object({
  id: z.uuid(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  photoUrl: z.url().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  professionIds: z.array(z.uuid()),
  languages: z.array(z.string()),
  answers: requirementAnswersSchema,
  status: profileStatusSchema,
  currentStep: z.number().int(),
});
export type WorkerProfile = z.infer<typeof workerProfileSchema>;

// ── Hirer onboarding ─────────────────────────────────────────────────────────

/**
 * "Who are you hiring as?" step. Individuals need nothing more; a business needs
 * a legal name, an optional org type, and — if GST-registered — a valid GSTIN.
 */
export const hirerTypeStepSchema = z
  .object({
    hirerType: hirerTypeSchema,
    orgName: z.string().trim().min(1).max(160).nullish(),
    orgType: orgTypeSchema.nullish(),
    gstRegistered: z.boolean().default(false),
    gstin: gstinSchema.nullish(),
  })
  .superRefine((data, ctx) => {
    if (data.hirerType !== "business") return;
    if (!data.orgName) {
      ctx.addIssue({
        code: "custom",
        path: ["orgName"],
        message: "Organization name is required for a business",
      });
    }
    if (data.gstRegistered && !data.gstin) {
      ctx.addIssue({
        code: "custom",
        path: ["gstin"],
        message: "Enter your GSTIN, or turn off GST registered",
      });
    }
  });
export type HirerTypeStep = z.infer<typeof hirerTypeStepSchema>;

/**
 * Partial per-step save for a hirer draft (PATCH /api/app/hirer-profile). Every
 * field optional; the business/GST cross-field rules are enforced at submit.
 */
export const hirerProfileUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(60).optional(),
    lastName: z.string().trim().min(1).max(60).optional(),
    photoUrl: z.url().nullish(),
    city: z.string().trim().min(1).max(120).optional(),
    state: z.string().trim().min(1).max(120).optional(),
    lat: z.number().min(-90).max(90).nullish(),
    lng: z.number().min(-180).max(180).nullish(),
    hirerType: hirerTypeSchema.optional(),
    orgName: z.string().trim().max(160).nullish(),
    orgType: orgTypeSchema.nullish(),
    gstRegistered: z.boolean().optional(),
    gstin: gstinSchema.nullish(),
    currentStep: z.number().int().min(0).max(20).optional(),
  })
  .strict();
export type HirerProfileUpdate = z.infer<typeof hirerProfileUpdateSchema>;

/** Validation applied at hirer submit (static fields + business/GST rules). */
export const hirerSubmitSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(60),
    lastName: z.string().trim().min(1, "Last name is required").max(60),
    photoUrl: z.url("A profile photo is required"),
    city: z.string().trim().min(1, "City is required").max(120),
    state: z.string().trim().min(1, "State is required").max(120),
    hirerType: hirerTypeSchema,
    orgName: z.string().trim().min(1).max(160).nullish(),
    orgType: orgTypeSchema.nullish(),
    gstRegistered: z.boolean().default(false),
    gstin: gstinSchema.nullish(),
  })
  .superRefine((data, ctx) => {
    if (data.hirerType !== "business") return;
    if (!data.orgName) {
      ctx.addIssue({
        code: "custom",
        path: ["orgName"],
        message: "Organization name is required for a business",
      });
    }
    if (data.gstRegistered && !data.gstin) {
      ctx.addIssue({
        code: "custom",
        path: ["gstin"],
        message: "Enter your GSTIN, or turn off GST registered",
      });
    }
  });

/** Full hirer profile as returned by GET /api/app/me. */
export const hirerProfileSchema = z.object({
  id: z.uuid(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  photoUrl: z.url().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  hirerType: hirerTypeSchema.nullish(),
  orgName: z.string().nullish(),
  orgType: orgTypeSchema.nullish(),
  gstRegistered: z.boolean(),
  gstin: z.string().nullish(),
  status: profileStatusSchema,
  currentStep: z.number().int(),
});
export type HirerProfile = z.infer<typeof hirerProfileSchema>;

// ── Role selection + onboarding state ────────────────────────────────────────

/** "Continue as" — picks the marketplace role (worker or hirer). */
export const selectRoleSchema = z.object({
  userType: z.enum(["worker", "hirer"]),
});
export type SelectRole = z.infer<typeof selectRoleSchema>;

/**
 * The mobile onboarding state (GET /api/app/me) the SessionGate routes on and the
 * wizard hydrates from: the chosen role, the draft's status + resumable step, and
 * whichever profile exists. `userType` null ⇒ no role picked yet ("Continue as").
 */
export const onboardingStateSchema = z.object({
  userType: userTypeSchema.nullish(),
  status: profileStatusSchema.nullish(),
  currentStep: z.number().int().nullish(),
  worker: workerProfileSchema.nullish(),
  hirer: hirerProfileSchema.nullish(),
});
export type OnboardingState = z.infer<typeof onboardingStateSchema>;

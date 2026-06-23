import * as React from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LANGUAGES,
  nameStepSchema,
  locationStepSchema,
  photoStepSchema,
  type OnboardingState,
  type RequirementAnswers,
} from "@odj/shared";
import { appApi, ONBOARDING_STATE_KEY } from "@/lib/app-api";
import { useOnboardingState } from "@/lib/use-onboarding";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Chips } from "@/components/ui/chips";
import { WizardLayout } from "@/components/onboarding/wizard-layout";
import { ImageField } from "@/components/onboarding/image-field";
import { LocationPicker } from "@/components/onboarding/location-picker";
import { SkillsStep } from "@/components/onboarding/worker/skills-step";
import { RequirementsStep } from "@/components/onboarding/worker/requirements-step";

const STEP_TITLES = [
  "Your name",
  "Profile photo",
  "Where are you?",
  "Your skills",
  "Languages you speak",
  "A few more details",
  "Review & submit",
];
const TOTAL = STEP_TITLES.length;

interface WorkerForm {
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  professionIds: string[];
  languages: string[];
  answers: RequirementAnswers;
}

const EMPTY: WorkerForm = {
  firstName: "",
  lastName: "",
  photoUrl: null,
  city: "",
  state: "",
  lat: null,
  lng: null,
  professionIds: [],
  languages: [],
  answers: {},
};

function hydrate(state: OnboardingState | undefined): WorkerForm {
  const w = state?.worker;
  if (!w) return EMPTY;
  return {
    firstName: w.firstName ?? "",
    lastName: w.lastName ?? "",
    photoUrl: w.photoUrl ?? null,
    city: w.city ?? "",
    state: w.state ?? "",
    lat: w.lat ?? null,
    lng: w.lng ?? null,
    professionIds: w.professionIds ?? [],
    languages: w.languages ?? [],
    answers: w.answers ?? {},
  };
}

/**
 * Worker onboarding wizard. One step per screen; each "Next" persists the step
 * server-side (so progress resumes after a quit) and advances. Final submit moves
 * the profile to "under review". State hydrates once from GET /api/app/me.
 */
export default function WorkerWizard() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: state, isLoading } = useOnboardingState();

  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState<WorkerForm>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  // Seed the form once, the first render the onboarding state is available.
  // Setting state during render (converging, guarded by `hydrated`) is React's
  // sanctioned way to initialise from async data — no sync-in-effect.
  if (!hydrated && state) {
    setForm(hydrate(state));
    setStep(Math.min(Math.max(state.worker?.currentStep ?? 0, 0), TOTAL - 1));
    setHydrated(true);
  }

  function update(patch: Partial<WorkerForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function setAnswer(key: string, value: string | null) {
    setForm((f) => {
      const answers = { ...f.answers };
      if (value === null || value === "") delete answers[key];
      else answers[key] = value;
      return { ...f, answers };
    });
  }

  function cacheState(next: OnboardingState) {
    qc.setQueryData(ONBOARDING_STATE_KEY, next);
  }

  // Effective requirement fields for the chosen professions — shares the query
  // key with RequirementsStep (deduped), used to enforce required answers before
  // advancing past the requirements step.
  const reqFieldsQ = useQuery({
    queryKey: ["app-effreq", [...form.professionIds].sort().join(",")],
    queryFn: () => appApi.effectiveRequirements(form.professionIds),
    enabled: form.professionIds.length > 0,
  });

  // Save the current step to the server, then advance. Each step decides what to
  // validate and persist; professions go through their dedicated endpoint.
  async function next() {
    setError(null);
    setBusy(true);
    try {
      const nextStep = step + 1;
      switch (step) {
        case 0: {
          const parsed = nameStepSchema.safeParse(form);
          if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
          cacheState(
            await appApi.saveWorker({ ...parsed.data, currentStep: nextStep }),
          );
          break;
        }
        case 1: {
          const parsed = photoStepSchema.safeParse({ photoUrl: form.photoUrl });
          if (!parsed.success) throw new Error("Add a profile photo to continue");
          cacheState(
            await appApi.saveWorker({
              photoUrl: parsed.data.photoUrl,
              currentStep: nextStep,
            }),
          );
          break;
        }
        case 2: {
          const parsed = locationStepSchema.safeParse(form);
          if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
          cacheState(
            await appApi.saveWorker({ ...parsed.data, currentStep: nextStep }),
          );
          break;
        }
        case 3: {
          if (form.professionIds.length === 0)
            throw new Error("Pick at least one profession");
          await appApi.saveWorkerProfessions(form.professionIds);
          cacheState(await appApi.saveWorker({ currentStep: nextStep }));
          break;
        }
        case 4: {
          if (form.languages.length === 0)
            throw new Error("Pick at least one language");
          cacheState(
            await appApi.saveWorker({
              languages: form.languages,
              currentStep: nextStep,
            }),
          );
          break;
        }
        case 5: {
          const missing = (reqFieldsQ.data ?? [])
            .filter((f) => f.required)
            .filter((f) => {
              const a = form.answers[f.key];
              return (
                a === undefined ||
                (typeof a === "string" && a.trim() === "") ||
                (Array.isArray(a) && a.length === 0)
              );
            });
          if (missing.length > 0)
            throw new Error(
              `Please fill: ${missing.map((f) => f.label).join(", ")}`,
            );
          cacheState(
            await appApi.saveWorker({
              answers: form.answers,
              currentStep: nextStep,
            }),
          );
          break;
        }
      }
      setStep(nextStep);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const result = await appApi.submitWorker();
      cacheState(result);
      router.replace("/(onboarding)/under-review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit — try again");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  const isLast = step === TOTAL - 1;
  const footer = (
    <Button
      size="lg"
      disabled={busy}
      onPress={isLast ? submit : next}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text>{isLast ? "Submit for verification" : "Continue"}</Text>
      )}
    </Button>
  );

  return (
    <WizardLayout
      step={step}
      total={TOTAL}
      title={STEP_TITLES[step]!}
      onBack={step > 0 && !busy ? () => setStep(step - 1) : undefined}
      footer={footer}
    >
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      {step === 0 && (
        <View className="gap-4">
          <Field label="First name" required>
            <Input
              value={form.firstName}
              onChangeText={(firstName) => update({ firstName })}
              placeholder="First name"
              autoCapitalize="words"
            />
          </Field>
          <Field label="Last name" required>
            <Input
              value={form.lastName}
              onChangeText={(lastName) => update({ lastName })}
              placeholder="Last name"
              autoCapitalize="words"
            />
          </Field>
        </View>
      )}

      {step === 1 && (
        <View className="items-center gap-2 pt-4">
          <ImageField
            value={form.photoUrl}
            onChange={(photoUrl) => update({ photoUrl })}
          />
          <Text className="text-center text-sm text-muted-foreground">
            A clear photo helps hirers trust your profile.
          </Text>
        </View>
      )}

      {step === 2 && (
        <LocationPicker
          value={{
            city: form.city,
            state: form.state,
            lat: form.lat,
            lng: form.lng,
          }}
          onChange={(v) =>
            update({ city: v.city, state: v.state, lat: v.lat ?? null, lng: v.lng ?? null })
          }
        />
      )}

      {step === 3 && (
        <SkillsStep
          selected={form.professionIds}
          onChange={(professionIds) => update({ professionIds })}
        />
      )}

      {step === 4 && (
        <Field label="Select all that apply" required>
          <Chips
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            selected={form.languages}
            onChange={(languages) => update({ languages })}
          />
        </Field>
      )}

      {step === 5 && (
        <RequirementsStep
          professionIds={form.professionIds}
          answers={form.answers}
          onChange={setAnswer}
        />
      )}

      {step === 6 && (
        <View className="gap-3">
          <Text className="text-muted-foreground">
            Please review your details. After submitting, your profile goes for
            verification — we&apos;ll notify you within 24 hours.
          </Text>
          <ReviewRow label="Name" value={`${form.firstName} ${form.lastName}`} />
          <ReviewRow label="City" value={`${form.city}, ${form.state}`} />
          <ReviewRow
            label="Professions"
            value={`${form.professionIds.length} selected`}
          />
          <ReviewRow
            label="Languages"
            value={
              form.languages
                .map((c) => LANGUAGES.find((l) => l.code === c)?.label ?? c)
                .join(", ") || "—"
            }
          />
        </View>
      )}
    </WizardLayout>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between border-b border-border py-2">
      <Text className="text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right font-poppins-medium">{value}</Text>
    </View>
  );
}

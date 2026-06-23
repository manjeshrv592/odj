import * as React from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LANGUAGES,
  nameStepSchema,
  photoStepSchema,
  locationStepSchema,
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
import { ImageField } from "@/components/onboarding/image-field";
import { LocationPicker } from "@/components/onboarding/location-picker";
import { SkillsStep } from "@/components/onboarding/worker/skills-step";
import { RequirementsStep } from "@/components/onboarding/worker/requirements-step";

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
 * Consolidated worker edit screen used to fix a rejected profile and re-submit.
 * Unlike the step wizard, everything is on one scroll so the applicant can jump
 * straight to whatever the reviewer flagged. Re-submit persists all fields, the
 * professions, then submits → `under_review` (server clears the prior rejection).
 */
export default function EditWorker() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: state, isLoading } = useOnboardingState();

  const [form, setForm] = React.useState<WorkerForm>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  if (!hydrated && state) {
    setForm(hydrate(state));
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

  async function resubmit() {
    setError(null);
    setBusy(true);
    try {
      if (!nameStepSchema.safeParse(form).success)
        throw new Error("Enter your first and last name");
      if (!photoStepSchema.safeParse({ photoUrl: form.photoUrl }).success)
        throw new Error("Add a profile photo");
      if (!locationStepSchema.safeParse(form).success)
        throw new Error("Enter your city and state");
      if (form.professionIds.length === 0)
        throw new Error("Pick at least one profession");
      if (form.languages.length === 0)
        throw new Error("Pick at least one language");

      await appApi.saveWorker({
        firstName: form.firstName,
        lastName: form.lastName,
        photoUrl: form.photoUrl,
        city: form.city,
        state: form.state,
        lat: form.lat,
        lng: form.lng,
        languages: form.languages,
        answers: form.answers,
      });
      await appApi.saveWorkerProfessions(form.professionIds);
      const next = await appApi.submitWorker();
      qc.setQueryData(ONBOARDING_STATE_KEY, next);
      router.replace("/(onboarding)/under-review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't re-submit — try again");
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

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 p-6">
        <View className="gap-1">
          <Text className="text-2xl font-poppins-semibold">Update your profile</Text>
          <Text className="text-muted-foreground">
            Make the changes below, then re-submit for verification.
          </Text>
        </View>

        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

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

        <View className="items-center gap-2">
          <ImageField
            value={form.photoUrl}
            onChange={(photoUrl) => update({ photoUrl })}
          />
        </View>

        <LocationPicker
          value={{ city: form.city, state: form.state, lat: form.lat, lng: form.lng }}
          onChange={(v) =>
            update({ city: v.city, state: v.state, lat: v.lat ?? null, lng: v.lng ?? null })
          }
        />

        <View className="gap-2">
          <Text className="font-poppins-medium">Your skills</Text>
          <SkillsStep
            selected={form.professionIds}
            onChange={(professionIds) => update({ professionIds })}
          />
        </View>

        <Field label="Languages you speak" required>
          <Chips
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            selected={form.languages}
            onChange={(languages) => update({ languages })}
          />
        </Field>

        <View className="gap-2">
          <Text className="font-poppins-medium">A few more details</Text>
          <RequirementsStep
            professionIds={form.professionIds}
            answers={form.answers}
            onChange={setAnswer}
          />
        </View>
      </ScrollView>
      <View className="p-6">
        <Button size="lg" disabled={busy} onPress={resubmit}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text>Re-submit for verification</Text>
          )}
        </Button>
      </View>
    </SafeAreaView>
  );
}

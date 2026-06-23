import * as React from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  nameStepSchema,
  locationStepSchema,
  photoStepSchema,
  hirerTypeStepSchema,
  type HirerType,
  type OrgType,
  type OnboardingState,
} from "@odj/shared";
import { appApi, ONBOARDING_STATE_KEY } from "@/lib/app-api";
import { useOnboardingState } from "@/lib/use-onboarding";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { WizardLayout } from "@/components/onboarding/wizard-layout";
import { ImageField } from "@/components/onboarding/image-field";
import { LocationPicker } from "@/components/onboarding/location-picker";

const STEP_TITLES = [
  "Your name",
  "Profile picture",
  "Where are you?",
  "Who are you hiring as?",
  "Review & submit",
];
const TOTAL = STEP_TITLES.length;

const ORG_TYPES: { value: OrgType; label: string }[] = [
  { value: "pvt_ltd", label: "Private Limited" },
  { value: "llp", label: "LLP" },
  { value: "partnership", label: "Partnership" },
  { value: "proprietorship", label: "Proprietorship" },
  { value: "other", label: "Other" },
];

interface HirerForm {
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  hirerType: HirerType | null;
  orgName: string;
  orgType: OrgType | null;
  gstRegistered: boolean;
  gstin: string;
}

const EMPTY: HirerForm = {
  firstName: "",
  lastName: "",
  photoUrl: null,
  city: "",
  state: "",
  lat: null,
  lng: null,
  hirerType: null,
  orgName: "",
  orgType: null,
  gstRegistered: false,
  gstin: "",
};

function hydrate(state: OnboardingState | undefined): HirerForm {
  const h = state?.hirer;
  if (!h) return EMPTY;
  return {
    firstName: h.firstName ?? "",
    lastName: h.lastName ?? "",
    photoUrl: h.photoUrl ?? null,
    city: h.city ?? "",
    state: h.state ?? "",
    lat: h.lat ?? null,
    lng: h.lng ?? null,
    hirerType: h.hirerType ?? null,
    orgName: h.orgName ?? "",
    orgType: h.orgType ?? null,
    gstRegistered: h.gstRegistered ?? false,
    gstin: h.gstin ?? "",
  };
}

/**
 * Hirer onboarding wizard. Individuals finish after the basics; businesses add a
 * legal name, optional org type, and an optional GSTIN. Each step persists to the
 * server (resumable); submit moves the profile to "under review".
 */
export default function HirerWizard() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: state, isLoading } = useOnboardingState();

  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState<HirerForm>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  // Seed the form once, the first render the onboarding state is available.
  // Setting state during render (converging, guarded by `hydrated`) is React's
  // sanctioned way to initialise from async data — no sync-in-effect.
  if (!hydrated && state) {
    setForm(hydrate(state));
    setStep(Math.min(Math.max(state.hirer?.currentStep ?? 0, 0), TOTAL - 1));
    setHydrated(true);
  }

  function update(patch: Partial<HirerForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function cacheState(next: OnboardingState) {
    qc.setQueryData(ONBOARDING_STATE_KEY, next);
  }

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
            await appApi.saveHirer({ ...parsed.data, currentStep: nextStep }),
          );
          break;
        }
        case 1: {
          const parsed = photoStepSchema.safeParse({ photoUrl: form.photoUrl });
          if (!parsed.success) throw new Error("Add a profile picture to continue");
          cacheState(
            await appApi.saveHirer({
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
            await appApi.saveHirer({ ...parsed.data, currentStep: nextStep }),
          );
          break;
        }
        case 3: {
          const parsed = hirerTypeStepSchema.safeParse({
            hirerType: form.hirerType,
            orgName: form.orgName || null,
            orgType: form.orgType,
            gstRegistered: form.gstRegistered,
            gstin: form.gstin || null,
          });
          if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
          cacheState(
            await appApi.saveHirer({
              hirerType: parsed.data.hirerType,
              orgName: parsed.data.orgName ?? null,
              orgType: parsed.data.orgType ?? null,
              gstRegistered: parsed.data.gstRegistered,
              gstin: parsed.data.gstin ?? null,
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
      cacheState(await appApi.submitHirer());
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
    <Button size="lg" disabled={busy} onPress={isLast ? submit : next}>
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
        <View className="gap-5">
          <View className="flex-row gap-3">
            <Button
              className="flex-1"
              variant={form.hirerType === "individual" ? "default" : "outline"}
              onPress={() => update({ hirerType: "individual" })}
            >
              <Text>Individual</Text>
            </Button>
            <Button
              className="flex-1"
              variant={form.hirerType === "business" ? "default" : "outline"}
              onPress={() => update({ hirerType: "business" })}
            >
              <Text>Business</Text>
            </Button>
          </View>

          {form.hirerType === "business" && (
            <View className="gap-4">
              <Field label="Legal / organization name" required>
                <Input
                  value={form.orgName}
                  onChangeText={(orgName) => update({ orgName })}
                  placeholder="e.g. Acme Services Pvt Ltd"
                />
              </Field>
              <Field label="Organization type" hint="Optional">
                <Select
                  value={form.orgType}
                  options={ORG_TYPES}
                  placeholder="Select org type"
                  onChange={(orgType) => update({ orgType: orgType as OrgType })}
                />
              </Field>
              <View className="flex-row items-center justify-between">
                <Text className="font-poppins-medium">GST registered?</Text>
                <Switch
                  value={form.gstRegistered}
                  onValueChange={(gstRegistered) => update({ gstRegistered })}
                />
              </View>
              {form.gstRegistered && (
                <Field label="GSTIN" required hint="15-character GST number">
                  <Input
                    value={form.gstin}
                    onChangeText={(gstin) => update({ gstin: gstin.toUpperCase() })}
                    placeholder="22AAAAA0000A1Z5"
                    autoCapitalize="characters"
                    maxLength={15}
                  />
                </Field>
              )}
            </View>
          )}
        </View>
      )}

      {step === 4 && (
        <View className="gap-3">
          <Text className="text-muted-foreground">
            Please review your details. After submitting, your profile goes for
            verification — we&apos;ll notify you within 24 hours.
          </Text>
          <ReviewRow label="Name" value={`${form.firstName} ${form.lastName}`} />
          <ReviewRow label="City" value={`${form.city}, ${form.state}`} />
          <ReviewRow
            label="Hiring as"
            value={form.hirerType === "business" ? "Business" : "Individual"}
          />
          {form.hirerType === "business" && (
            <>
              <ReviewRow label="Organization" value={form.orgName || "—"} />
              <ReviewRow
                label="GST"
                value={form.gstRegistered ? form.gstin || "Registered" : "Not registered"}
              />
            </>
          )}
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

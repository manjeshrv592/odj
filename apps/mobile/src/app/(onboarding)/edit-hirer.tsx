import * as React from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  nameStepSchema,
  photoStepSchema,
  locationStepSchema,
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
import { ImageField } from "@/components/onboarding/image-field";
import { LocationPicker } from "@/components/onboarding/location-picker";

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
 * Consolidated hirer edit screen for fixing a rejected profile (see
 * {@link ../edit-worker}). One scroll; re-submit persists everything then submits
 * → `under_review`.
 */
export default function EditHirer() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: state, isLoading } = useOnboardingState();

  const [form, setForm] = React.useState<HirerForm>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  if (!hydrated && state) {
    setForm(hydrate(state));
    setHydrated(true);
  }

  function update(patch: Partial<HirerForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function resubmit() {
    setError(null);
    setBusy(true);
    try {
      if (!nameStepSchema.safeParse(form).success)
        throw new Error("Enter your first and last name");
      if (!photoStepSchema.safeParse({ photoUrl: form.photoUrl }).success)
        throw new Error("Add a profile picture");
      if (!locationStepSchema.safeParse(form).success)
        throw new Error("Enter your city and state");
      const typeStep = hirerTypeStepSchema.safeParse({
        hirerType: form.hirerType,
        orgName: form.orgName || null,
        orgType: form.orgType,
        gstRegistered: form.gstRegistered,
        gstin: form.gstin || null,
      });
      if (!typeStep.success)
        throw new Error(typeStep.error.issues[0]?.message ?? "Check your details");

      await appApi.saveHirer({
        firstName: form.firstName,
        lastName: form.lastName,
        photoUrl: form.photoUrl,
        city: form.city,
        state: form.state,
        lat: form.lat,
        lng: form.lng,
        hirerType: typeStep.data.hirerType,
        orgName: typeStep.data.orgName ?? null,
        orgType: typeStep.data.orgType ?? null,
        gstRegistered: typeStep.data.gstRegistered,
        gstin: typeStep.data.gstin ?? null,
      });
      const next = await appApi.submitHirer();
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

        <View className="gap-5">
          <Text className="font-poppins-medium">Who are you hiring as?</Text>
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

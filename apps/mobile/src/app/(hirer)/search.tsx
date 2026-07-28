import { View, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appApi, JOB_KEY } from "@/lib/app-api";
import { useOnboardingState } from "@/lib/use-onboarding";
import { useJob } from "@/lib/use-hirer";
import { Map, type MapPoint } from "@/components/map";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Hirer step 3 — live "searching…" map that flips to the matched worker. */
export default function HirerSearch() {
  const router = useRouter();
  const qc = useQueryClient();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { data: state } = useOnboardingState();
  const { data: job } = useJob(jobId ?? null);

  const center: MapPoint | null =
    state?.hirer?.lat != null && state?.hirer?.lng != null
      ? { lat: state.hirer.lat, lng: state.hirer.lng }
      : null;

  const worker = job?.matchedWorker;
  const markers: MapPoint[] = [];
  if (center) markers.push(center);
  if (worker?.lat != null && worker?.lng != null) {
    markers.push({ lat: worker.lat, lng: worker.lng });
  }

  const cancel = useMutation({
    mutationFn: () => appApi.cancelJob(jobId!),
    onSuccess: () => {
      if (jobId) qc.removeQueries({ queryKey: JOB_KEY(jobId) });
      router.back();
    },
    onError: (e: Error) => Alert.alert("Couldn't cancel", e.message),
  });

  const status = job?.status;
  const done = () => router.replace("/(hirer)" as Href);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <View className="flex-1">
        {center ? (
          <Map center={center} markers={markers} zoom={13} />
        ) : (
          <View className="flex-1 items-center justify-center p-6">
            <Text className="text-center text-muted-foreground">
              Your location isn&apos;t set — update it in your profile to search.
            </Text>
          </View>
        )}

        {/* Status card pinned over the map */}
        <View className="absolute inset-x-0 bottom-0 p-4">
          <Card className="gap-3">
            {(status === "matched" || status === "in_progress") && worker ? (
              <>
                <Text className="text-lg font-poppins-semibold text-foreground">
                  {status === "in_progress"
                    ? "🛠️ Job in progress"
                    : `✅ ${worker.name} matched`}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {status === "in_progress"
                    ? "Show your worker this code to complete the job:"
                    : job?.otpToShow
                      ? `${worker.name} is here — show them this code to start:`
                      : `${worker.name} accepted and is on the way. They'll start when they arrive.`}
                </Text>
                {job?.otpToShow ? (
                  <Text className="text-center text-4xl font-poppins-semibold tracking-widest text-primary">
                    {job.otpToShow}
                  </Text>
                ) : null}
                <Button
                  variant="outline"
                  onPress={() => cancel.mutate()}
                  disabled={cancel.isPending}
                >
                  <Text>{cancel.isPending ? "Cancelling…" : "Cancel job"}</Text>
                </Button>
              </>
            ) : status === "completed" ? (
              <>
                <Text className="text-lg font-poppins-semibold text-foreground">
                  ✅ Job complete
                </Text>
                <Text className="text-sm text-muted-foreground">
                  The job was completed and verified. Thanks for using ODJ!
                </Text>
                <Button onPress={done}>
                  <Text>Done</Text>
                </Button>
              </>
            ) : status === "cancelled" ? (
              <>
                <Text className="text-lg font-poppins-semibold text-foreground">
                  Job cancelled
                </Text>
                <Button onPress={done}>
                  <Text>Back to search</Text>
                </Button>
              </>
            ) : status === "no_workers" ? (
              <>
                <Text className="text-lg font-poppins-semibold text-foreground">
                  No workers available nearby
                </Text>
                <Text className="text-sm text-muted-foreground">
                  No one matching is online within range right now. Try again in a
                  bit.
                </Text>
                <Button onPress={done}>
                  <Text>Back to search</Text>
                </Button>
              </>
            ) : status === "expired" ? (
              <>
                <Text className="text-lg font-poppins-semibold text-foreground">
                  No one responded in time
                </Text>
                <Button onPress={done}>
                  <Text>Try again</Text>
                </Button>
              </>
            ) : (
              <>
                <View className="flex-row items-center gap-3">
                  <ActivityIndicator />
                  <Text className="text-lg font-poppins-semibold text-foreground">
                    Searching for workers…
                  </Text>
                </View>
                <Text className="text-sm text-muted-foreground">
                  Nearby workers are being notified. First to accept gets the job.
                </Text>
                <Button
                  variant="outline"
                  onPress={() => cancel.mutate()}
                  disabled={cancel.isPending}
                >
                  <Text>{cancel.isPending ? "Cancelling…" : "Cancel"}</Text>
                </Button>
              </>
            )}
          </Card>
        </View>
      </View>
    </SafeAreaView>
  );
}

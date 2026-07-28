import * as React from "react";
import { View, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appApi, WORKER_JOB_KEY } from "@/lib/app-api";
import { useWorkerJob } from "@/lib/use-worker";
import { Map, type MapPoint } from "@/components/map";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";

/** Worker's active job: navigate to the hirer, verify start, then verify completion. */
export default function WorkerJobScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: job, isLoading } = useWorkerJob();
  const [code, setCode] = React.useState("");
  const [completed, setCompleted] = React.useState(false);

  const verify = useMutation({
    mutationFn: (phase: "start" | "end") =>
      phase === "start"
        ? appApi.verifyStart(job!.id, code)
        : appApi.verifyEnd(job!.id, code),
    onSuccess: async (_d, phase) => {
      setCode("");
      if (phase === "end") setCompleted(true);
      await qc.invalidateQueries({ queryKey: WORKER_JOB_KEY });
    },
    onError: (e: Error) => Alert.alert("Couldn't verify", e.message),
  });

  const requestStart = useMutation({
    mutationFn: () => appApi.requestStart(job!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: WORKER_JOB_KEY }),
    onError: (e: Error) => Alert.alert("Couldn't start", e.message),
  });

  const cancel = useMutation({
    mutationFn: () => appApi.cancelWorkerJob(job!.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: WORKER_JOB_KEY });
      router.replace("/home");
    },
    onError: (e: Error) => Alert.alert("Couldn't cancel", e.message),
  });

  const finish = () => router.replace("/home");

  // Completed (locally, since the job drops off the active list once done).
  if (completed) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background p-6">
        <Text className="text-5xl">✅</Text>
        <Text className="text-2xl font-poppins-semibold text-foreground">
          Job complete
        </Text>
        <Text className="text-center text-muted-foreground">
          Nice work. The hirer has been notified.
        </Text>
        <Button onPress={finish}>
          <Text>Done</Text>
        </Button>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background p-6">
        <Text className="text-2xl font-poppins-semibold text-foreground">
          No active job
        </Text>
        <Text className="text-center text-muted-foreground">
          This job has ended.
        </Text>
        <Button onPress={finish}>
          <Text>Back to home</Text>
        </Button>
      </SafeAreaView>
    );
  }

  const center: MapPoint | null =
    job.hirer.lat != null && job.hirer.lng != null
      ? { lat: job.hirer.lat, lng: job.hirer.lng }
      : null;
  const started = job.status === "in_progress";
  const awaitingStartTap = job.status === "matched" && !job.startRequested;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-5 p-6">
        <View className="gap-1 pt-2">
          <Text className="text-2xl font-poppins-semibold text-foreground">
            {started ? "Job in progress" : "Head to the hirer"}
          </Text>
          <Text className="text-muted-foreground">
            {job.professionName} · {job.hirer.name}
          </Text>
        </View>

        {center ? (
          <View className="h-56 overflow-hidden rounded-2xl border border-border">
            <Map center={center} markers={[center]} zoom={14} />
          </View>
        ) : null}

        {awaitingStartTap ? (
          <Card className="gap-3">
            <Text className="font-poppins-medium text-foreground">
              You accepted this job for {job.hirer.name}.
            </Text>
            <Text className="text-sm text-muted-foreground">
              Head over. When you arrive, tap Start work — the hirer will then show
              you a start code to enter.
            </Text>
            <Button
              onPress={() => requestStart.mutate()}
              disabled={requestStart.isPending}
            >
              {requestStart.isPending ? (
                <ActivityIndicator />
              ) : (
                <Text>Start work</Text>
              )}
            </Button>
          </Card>
        ) : (
          <Card className="gap-3">
            <Text className="font-poppins-medium text-foreground">
              {started
                ? "Finished? Enter the completion code the hirer shows you."
                : "Enter the start code the hirer shows you."}
            </Text>
            <OtpInput value={code} onChange={setCode} length={4} />
            <Button
              onPress={() => verify.mutate(started ? "end" : "start")}
              disabled={code.length !== 4 || verify.isPending}
            >
              {verify.isPending ? (
                <ActivityIndicator />
              ) : (
                <Text>{started ? "Complete job" : "Verify & start"}</Text>
              )}
            </Button>
          </Card>
        )}

        <Button
          variant="ghost"
          onPress={() =>
            Alert.alert("Cancel job?", "This ends the job for both of you.", [
              { text: "Keep going", style: "cancel" },
              {
                text: "Cancel job",
                style: "destructive",
                onPress: () => cancel.mutate(),
              },
            ])
          }
          disabled={cancel.isPending}
        >
          <Text className="text-destructive">Cancel job</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

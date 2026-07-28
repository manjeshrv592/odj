import * as React from "react";
import { View, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WorkerOffer } from "@odj/shared";
import {
  appApi,
  ONBOARDING_STATE_KEY,
  WORKER_OFFERS_KEY,
} from "@/lib/app-api";
import { useOnboardingState } from "@/lib/use-onboarding";
import { useWorkerOffers, useWorkerJob } from "@/lib/use-worker";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

/** One incoming job offer with accept/decline. */
function OfferCard({
  offer,
  onAccept,
  onDecline,
  busy,
}: {
  offer: WorkerOffer;
  onAccept: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  return (
    <Card className="gap-2 border-primary">
      <Text className="font-poppins-semibold text-foreground">
        {offer.professionName}
      </Text>
      <Text className="text-sm text-muted-foreground">
        ~{offer.distanceKm} km away
      </Text>
      <View className="flex-row gap-2 pt-1">
        <Button className="flex-1" onPress={onAccept} disabled={busy}>
          <Text>Accept</Text>
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onPress={onDecline}
          disabled={busy}
        >
          <Text>Decline</Text>
        </Button>
      </View>
    </Card>
  );
}

export default function WorkerHome() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: state } = useOnboardingState();

  const { data: activeJob } = useWorkerJob();

  const [online, setOnline] = React.useState(false);
  // Seed the toggle from the server's persisted presence once loaded.
  React.useEffect(() => {
    if (state?.worker?.isOnline != null) setOnline(state.worker.isOnline);
  }, [state?.worker?.isOnline]);

  const { data: offers } = useWorkerOffers(online);

  const toggleOnline = useMutation({
    mutationFn: (next: boolean) => appApi.setOnline(next),
    onMutate: (next) => setOnline(next),
    onError: (e: Error, next) => {
      setOnline(!next);
      Alert.alert("Couldn't update", e.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ONBOARDING_STATE_KEY }),
  });

  const respond = useMutation({
    mutationFn: async (v: { offerId: string; accept: boolean }) => {
      if (v.accept) await appApi.acceptOffer(v.offerId);
      else await appApi.declineOffer(v.offerId);
    },
    onSuccess: (_data, v) => {
      qc.invalidateQueries({ queryKey: WORKER_OFFERS_KEY });
      if (v.accept) router.push("/job" as Href);
    },
    onError: (e: Error) => {
      qc.invalidateQueries({ queryKey: WORKER_OFFERS_KEY });
      Alert.alert("Request unavailable", e.message);
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-5 p-6">
        <View className="items-center gap-1 pt-4">
          <Text className="text-2xl font-poppins-semibold text-foreground">
            You&apos;re all set
          </Text>
          <Text className="text-center text-muted-foreground">
            Go online to start receiving job requests near you.
          </Text>
        </View>

        {activeJob ? (
          <Button
            className="h-auto items-center justify-start gap-3 border-primary p-4"
            variant="outline"
            onPress={() => router.push("/job" as Href)}
          >
            <Text className="text-2xl">🧰</Text>
            <View className="flex-1">
              <Text className="font-poppins-medium text-foreground">
                Active job — {activeJob.professionName}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {activeJob.status === "in_progress"
                  ? "In progress · tap to complete"
                  : "Tap to head over & start"}
              </Text>
            </View>
            <Text className="text-2xl text-muted-foreground">›</Text>
          </Button>
        ) : null}

        <Card className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="font-poppins-medium text-foreground">
              {online ? "You're online" : "You're offline"}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {online
                ? "Listening for nearby job requests…"
                : "Turn on to receive job offers"}
            </Text>
          </View>
          <Switch
            value={online}
            onValueChange={(v) => toggleOnline.mutate(v)}
          />
        </Card>

        {online ? (
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Text className="font-poppins-medium text-foreground">
                Incoming requests
              </Text>
              {(offers ?? []).length === 0 ? <ActivityIndicator size="small" /> : null}
            </View>
            {(offers ?? []).length === 0 ? (
              <Text className="text-sm text-muted-foreground">
                Waiting for requests…
              </Text>
            ) : (
              (offers ?? []).map((o) => (
                <OfferCard
                  key={o.offerId}
                  offer={o}
                  busy={respond.isPending}
                  onAccept={() =>
                    respond.mutate({ offerId: o.offerId, accept: true })
                  }
                  onDecline={() =>
                    respond.mutate({ offerId: o.offerId, accept: false })
                  }
                />
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

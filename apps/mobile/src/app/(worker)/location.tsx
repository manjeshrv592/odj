import * as React from "react";
import { View, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appApi, ONBOARDING_STATE_KEY } from "@/lib/app-api";
import { useOnboardingState } from "@/lib/use-onboarding";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Captured = { lat: number; lng: number; accuracy: number | null };

export default function WorkerLocationScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: state } = useOnboardingState();
  const worker = state?.worker;

  const [capturing, setCapturing] = React.useState(false);
  const [captured, setCaptured] = React.useState<Captured | null>(null);

  const save = useMutation({
    mutationFn: (loc: Captured) =>
      appApi.saveWorkerLocation({
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ONBOARDING_STATE_KEY });
      Alert.alert("Saved", "Your location has been updated.");
    },
    onError: (e: Error) => Alert.alert("Couldn't save", e.message),
  });

  async function capture() {
    setCapturing(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Location permission needed",
          "Allow location access so hirers near you can find you.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const loc: Captured = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      };
      setCaptured(loc);
      save.mutate(loc);
    } catch {
      Alert.alert(
        "Couldn't get your location",
        "Please try again somewhere with a clearer signal.",
      );
    } finally {
      setCapturing(false);
    }
  }

  const hasStored = worker?.lat != null && worker?.lng != null;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-5 p-6">
        <View className="gap-1 pt-2">
          <Text className="text-2xl font-poppins-semibold text-foreground">
            Location
          </Text>
          <Text className="text-muted-foreground">
            Capture your precise current location so we can match you with nearby
            hirers. This is a one-time snapshot — tap again whenever you move.
          </Text>
        </View>

        <Card className="gap-2">
          <Text className="font-poppins-medium text-foreground">
            Current location on file
          </Text>
          {hasStored ? (
            <>
              <Text className="text-sm text-muted-foreground">
                {worker!.lat!.toFixed(5)}, {worker!.lng!.toFixed(5)}
              </Text>
              {captured?.accuracy != null ? (
                <Text className="text-sm text-muted-foreground">
                  Accuracy: ±{Math.round(captured.accuracy)} m
                </Text>
              ) : null}
            </>
          ) : (
            <Text className="text-sm text-muted-foreground">
              No precise location captured yet.
            </Text>
          )}
        </Card>

        <Card className="items-center gap-1 py-8">
          <Text className="text-3xl">🗺️</Text>
          <Text className="text-sm text-muted-foreground">
            Map preview coming soon
          </Text>
        </Card>
      </ScrollView>

      <View className="gap-2 p-6">
        <Button onPress={capture} disabled={capturing || save.isPending}>
          {capturing || save.isPending ? (
            <ActivityIndicator />
          ) : (
            <Text>📍 Update my precise location</Text>
          )}
        </Button>
        <Button variant="ghost" onPress={() => router.back()}>
          <Text>Done</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

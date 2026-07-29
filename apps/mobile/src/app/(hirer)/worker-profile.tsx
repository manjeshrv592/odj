import { View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { appApi, WORKER_PROFILE_VIEW_KEY } from "@/lib/app-api";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";

/** A matched worker's public profile + rating, as the hirer sees it. */
export default function WorkerProfileView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: worker, isLoading } = useQuery({
    queryKey: WORKER_PROFILE_VIEW_KEY(id ?? ""),
    queryFn: () => appApi.workerProfileView(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!worker) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-muted-foreground">Worker not found.</Text>
      </SafeAreaView>
    );
  }

  const name = [worker.firstName, worker.lastName].filter(Boolean).join(" ") || "Worker";

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="gap-5 p-6">
        <View className="items-center gap-3 pt-4">
          {worker.photoUrl ? (
            <Image
              source={{ uri: worker.photoUrl }}
              style={{ width: 96, height: 96, borderRadius: 48 }}
            />
          ) : null}
          <Text className="text-2xl font-poppins-semibold text-foreground">
            {name}
          </Text>
          {worker.city ? (
            <Text className="text-muted-foreground">
              {[worker.city, worker.state].filter(Boolean).join(", ")}
            </Text>
          ) : null}
        </View>

        <Card className="items-center gap-2">
          <StarRating value={Math.round(worker.avgRating ?? 0)} />
          <Text className="text-sm text-muted-foreground">
            {worker.ratingCount > 0
              ? `${worker.avgRating!.toFixed(1)} (${worker.ratingCount} rating${worker.ratingCount === 1 ? "" : "s"})`
              : "No ratings yet"}
          </Text>
        </Card>

        {worker.professions.length > 0 ? (
          <Card className="gap-1">
            <Text className="font-poppins-medium text-foreground">Works as</Text>
            <Text className="text-muted-foreground">
              {worker.professions.map((p) => p.name).join(", ")}
            </Text>
          </Card>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

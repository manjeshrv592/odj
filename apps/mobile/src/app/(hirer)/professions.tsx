import { View, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { appApi } from "@/lib/app-api";
import { useSession } from "@/lib/auth-client";
import { useOnboardingState } from "@/lib/use-onboarding";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

/** Hirer step 2 — pick the exact profession, then start a search. */
export default function HirerProfessions() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: state } = useOnboardingState();
  const params = useLocalSearchParams<{
    categoryId: string;
    categoryName?: string;
  }>();
  const categoryId = params.categoryId;

  const { data: professions, isLoading } = useQuery({
    queryKey: ["catalog", "professions", categoryId],
    queryFn: () => appApi.professions(categoryId),
    enabled: !!session?.user && !!categoryId,
  });

  const start = useMutation({
    mutationFn: (professionId: string) => {
      const lat = state?.hirer?.lat;
      const lng = state?.hirer?.lng;
      if (lat == null || lng == null) {
        throw new Error(
          "Your location isn't set. Please update it in your profile first.",
        );
      }
      return appApi.createJob({ professionId, lat, lng });
    },
    onSuccess: (job) =>
      router.push(`/(hirer)/search?jobId=${job.id}` as Href),
    onError: (e: Error) => Alert.alert("Couldn't start search", e.message),
  });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-5 p-6">
        <View className="gap-1 pt-2">
          <Text className="text-2xl font-poppins-semibold text-foreground">
            {params.categoryName ?? "Professions"}
          </Text>
          <Text className="text-muted-foreground">
            Tap a profession to search for an available worker nearby.
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator className="mt-8" />
        ) : (professions ?? []).length === 0 ? (
          <Text className="text-muted-foreground">
            No professions in this category yet.
          </Text>
        ) : (
          <View className="gap-3">
            {(professions ?? []).map((p) => (
              <Button
                key={p.id}
                variant="outline"
                className="h-auto items-center justify-start gap-3 p-4"
                disabled={start.isPending}
                onPress={() => start.mutate(p.id)}
              >
                <Text className="flex-1 font-poppins-medium text-foreground">
                  {p.name}
                </Text>
                {start.isPending ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="text-2xl text-muted-foreground">›</Text>
                )}
              </Button>
            ))}
          </View>
        )}
      </ScrollView>
      <View className="p-6">
        <Button variant="ghost" onPress={() => router.back()}>
          <Text className="text-muted-foreground">← Back</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

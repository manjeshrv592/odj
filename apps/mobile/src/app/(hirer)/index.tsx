import { View, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { appApi } from "@/lib/app-api";
import { useSession } from "@/lib/auth-client";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

/** Hirer Home tab — resume any active job, else pick a category to search. */
export default function HirerBrowse() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: categories, isLoading } = useQuery({
    queryKey: ["catalog", "categories"],
    queryFn: appApi.categories,
    enabled: !!session?.user,
  });
  const { data: activeJobs } = useQuery({
    queryKey: ["hirer", "jobs", "active"],
    queryFn: () => appApi.hirerJobs("active"),
    enabled: !!session?.user,
    refetchInterval: 5000,
  });
  const active = activeJobs?.[0];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-5 p-6">
        <View className="gap-1 pt-2">
          <Text className="text-2xl font-poppins-semibold text-foreground">
            What do you need?
          </Text>
          <Text className="text-muted-foreground">
            Pick a category, then the exact profession to search for.
          </Text>
        </View>

        {active ? (
          <Button
            variant="outline"
            className="h-auto items-center justify-start gap-3 border-primary p-4"
            onPress={() =>
              router.push(`/(hirer)/search?jobId=${active.id}` as Href)
            }
          >
            <Text className="text-2xl">🧰</Text>
            <View className="flex-1">
              <Text className="font-poppins-medium text-foreground">
                Active — {active.professionName}
              </Text>
              <Text className="text-sm text-muted-foreground">
                Tap to resume this search / job
              </Text>
            </View>
            <Text className="text-2xl text-muted-foreground">›</Text>
          </Button>
        ) : null}

        {isLoading ? (
          <ActivityIndicator className="mt-8" />
        ) : (categories ?? []).length === 0 ? (
          <Text className="text-muted-foreground">No categories yet.</Text>
        ) : (
          <View className="gap-3">
            {(categories ?? []).map((c) => (
              <Button
                key={c.id}
                variant="outline"
                className="h-auto items-center justify-start gap-3 p-4"
                onPress={() =>
                  router.push(
                    `/(hirer)/professions?categoryId=${c.id}&categoryName=${encodeURIComponent(
                      c.name,
                    )}` as Href,
                  )
                }
              >
                <Text className="flex-1 font-poppins-medium text-foreground">
                  {c.name}
                </Text>
                <Text className="text-2xl text-muted-foreground">›</Text>
              </Button>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

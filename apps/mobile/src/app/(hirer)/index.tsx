import { View, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { appApi } from "@/lib/app-api";
import { useSession } from "@/lib/auth-client";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

/** Hirer step 1 — pick a category of work. */
export default function HirerBrowse() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: categories, isLoading } = useQuery({
    queryKey: ["catalog", "categories"],
    queryFn: appApi.categories,
    enabled: !!session?.user,
  });

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
      <View className="p-6">
        <Button variant="ghost" onPress={() => router.back()}>
          <Text className="text-muted-foreground">← Back</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

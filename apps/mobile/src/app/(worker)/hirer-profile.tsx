import { View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { appApi, HIRER_PROFILE_VIEW_KEY } from "@/lib/app-api";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";

/** A worked-for hirer's public profile + rating, as the worker sees it. */
export default function HirerProfileView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: hirer, isLoading } = useQuery({
    queryKey: HIRER_PROFILE_VIEW_KEY(id ?? ""),
    queryFn: () => appApi.hirerProfileView(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!hirer) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-muted-foreground">Hirer not found.</Text>
      </SafeAreaView>
    );
  }

  const name = [hirer.firstName, hirer.lastName].filter(Boolean).join(" ") || "Hirer";

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="gap-5 p-6">
        <View className="items-center gap-3 pt-4">
          {hirer.photoUrl ? (
            <Image
              source={{ uri: hirer.photoUrl }}
              style={{ width: 96, height: 96, borderRadius: 48 }}
            />
          ) : null}
          <Text className="text-2xl font-poppins-semibold text-foreground">
            {name}
          </Text>
          {hirer.city ? (
            <Text className="text-muted-foreground">
              {[hirer.city, hirer.state].filter(Boolean).join(", ")}
            </Text>
          ) : null}
        </View>

        <Card className="items-center gap-2">
          <StarRating value={Math.round(hirer.avgRating ?? 0)} />
          <Text className="text-sm text-muted-foreground">
            {hirer.ratingCount > 0
              ? `${hirer.avgRating!.toFixed(1)} (${hirer.ratingCount} rating${hirer.ratingCount === 1 ? "" : "s"})`
              : "No ratings yet"}
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}

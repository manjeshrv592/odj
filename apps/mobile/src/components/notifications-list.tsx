import { View, Pressable, ActivityIndicator } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appApi, NOTIFICATIONS_KEY } from "@/lib/app-api";
import { useNotifications } from "@/lib/use-notifications";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The signed-in user's in-app notifications (verification decisions for now).
 * Unread rows are highlighted; tapping one marks it read. Reused on the home
 * screen for approved users.
 */
export function NotificationsList() {
  const qc = useQueryClient();
  const { data: notifications, isLoading } = useNotifications();

  const markRead = useMutation({
    mutationFn: (id: string) => appApi.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });

  if (isLoading) {
    return <ActivityIndicator />;
  }

  if (!notifications || notifications.length === 0) {
    return (
      <Text className="text-center text-sm text-muted-foreground">
        No notifications yet.
      </Text>
    );
  }

  return (
    <View className="w-full gap-2">
      {notifications.map((n) => (
        <Pressable key={n.id} onPress={() => !n.read && markRead.mutate(n.id)}>
          <Card className={cn("gap-1 p-4", !n.read && "border-primary")}>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="font-poppins-medium">{n.title}</Text>
              {!n.read ? (
                <View className="size-2 rounded-full bg-primary" />
              ) : null}
            </View>
            <Text className="text-sm text-muted-foreground">{n.body}</Text>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

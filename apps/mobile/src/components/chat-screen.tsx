import * as React from "react";
import {
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import type { ChatMessage, ChatSenderRole } from "@odj/shared";
import { useChat } from "@/lib/use-chat";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Map } from "@/components/map";

function fmtTime(d: Date): string {
  return new Date(d).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Bubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <View className={mine ? "items-end" : "items-start"}>
      <View
        className={
          "max-w-[80%] gap-1 rounded-2xl px-4 py-2 " +
          (mine ? "bg-primary" : "bg-secondary")
        }
      >
        {message.type === "text" ? (
          <Text
            className={mine ? "text-primary-foreground" : "text-secondary-foreground"}
          >
            {message.body}
          </Text>
        ) : message.lat != null && message.lng != null ? (
          <View className="h-32 w-56 overflow-hidden rounded-xl">
            <Map
              center={{ lat: message.lat, lng: message.lng }}
              markers={[{ lat: message.lat, lng: message.lng }]}
              zoom={14}
            />
          </View>
        ) : null}
      </View>
      <Text className="mt-0.5 text-xs text-muted-foreground">
        {fmtTime(message.createdAt)}
      </Text>
    </View>
  );
}

/**
 * Shared chat UI for `(worker)/chat` and `(hirer)/chat` — text + one-off
 * location sharing, live over WebSocket while the job is matched/in_progress,
 * read-only (composer hidden) once it ends. `myRole` decides bubble side.
 */
export function ChatScreen({
  jobId,
  myRole,
}: {
  jobId: string;
  myRole: ChatSenderRole;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = React.useState(0);
  const {
    messages,
    isLoading,
    canSend,
    otherOnline,
    otherTyping,
    sendText,
    sendLocation,
    notifyTyping,
  } = useChat(jobId);
  const [draft, setDraft] = React.useState("");
  const [sharingLocation, setSharingLocation] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);

  function submitText() {
    const body = draft.trim();
    if (!body) return;
    sendText(body);
    setDraft("");
  }

  async function shareLocation() {
    setSharingLocation(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Location permission needed", "Allow location access to share it.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      sendLocation(pos.coords.latitude, pos.coords.longitude);
    } catch {
      Alert.alert("Couldn't get your location", "Please try again.");
    } finally {
      setSharingLocation(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View
        className="flex-row items-center gap-3 border-b border-border px-4 py-3"
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl text-foreground">←</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="font-poppins-medium text-foreground">Chat</Text>
          <Text className="text-xs text-muted-foreground">
            {otherTyping ? "typing…" : otherOnline ? "🟢 Online" : "Offline"}
          </Text>
        </View>
      </View>

      {/* `keyboardVerticalOffset` accounts for the header above this view (+ the
          top safe-area inset) — without it, "padding" under-adjusts by exactly
          that height and the composer ends up behind the keyboard. Using
          "padding" on both platforms; RN's "height" mode is flakier under
          Android edge-to-edge (the default since Expo SDK 53), which makes the
          native `windowSoftInputMode="adjustResize"` manifest setting a no-op. */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={insets.top + headerHeight}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerClassName="gap-3 p-4"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <Text className="mt-6 text-center text-sm text-muted-foreground">
              No messages yet — say hello.
            </Text>
          ) : (
            messages.map((m) => (
              <Bubble key={m.id} message={m} mine={m.senderRole === myRole} />
            ))
          )}
        </ScrollView>

        {canSend ? (
          <View className="flex-row items-center gap-2 border-t border-border p-3">
            <Button
              variant="outline"
              size="sm"
              onPress={shareLocation}
              disabled={sharingLocation}
            >
              {sharingLocation ? <ActivityIndicator /> : <Text>📍</Text>}
            </Button>
            <Input
              className="flex-1"
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                notifyTyping();
              }}
              placeholder="Message"
              onSubmitEditing={submitText}
              returnKeyType="send"
            />
            <Button size="sm" onPress={submitText} disabled={!draft.trim()}>
              <Text>Send</Text>
            </Button>
          </View>
        ) : (
          <View className="border-t border-border p-3">
            <Text className="text-center text-sm text-muted-foreground">
              This job has ended — chat is read-only.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

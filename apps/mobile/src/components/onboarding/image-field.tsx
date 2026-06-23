import * as React from "react";
import { View, Pressable, ActivityIndicator, Alert } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Text } from "@/components/ui/text";
import { uploadToUploadcare, isUploadConfigured } from "@/lib/uploadcare";
import { cn } from "@/lib/utils";

/**
 * Pick an image (gallery or camera) and upload it to Uploadcare, surfacing the
 * resulting CDN url to the caller. Used for the profile photo and for `file`
 * requirement fields. Document (PDF) picking is deferred — workers photograph
 * their documents for now (most allowed types are jpg/png).
 */
export function ImageField({
  value,
  onChange,
  shape = "circle",
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  shape?: "circle" | "square";
}) {
  const [uploading, setUploading] = React.useState(false);

  async function pick(source: "library" | "camera") {
    try {
      const perm =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          `Allow ${source === "camera" ? "camera" : "photo"} access to continue.`,
        );
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              quality: 0.7,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.7,
            });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;
      setUploading(true);
      const url = await uploadToUploadcare({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });
      onChange(url);
    } catch (e) {
      Alert.alert(
        "Upload failed",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  function choose() {
    if (!isUploadConfigured()) {
      Alert.alert(
        "Upload not configured",
        "Image upload isn't set up yet (EXPO_PUBLIC_UPLOADCARE_PUBLIC_KEY).",
      );
      return;
    }
    Alert.alert("Add photo", undefined, [
      { text: "Take photo", onPress: () => void pick("camera") },
      { text: "Choose from gallery", onPress: () => void pick("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const rounded = shape === "circle" ? "rounded-full" : "rounded-xl";

  return (
    <View className="items-center gap-3">
      <Pressable
        onPress={choose}
        disabled={uploading}
        accessibilityRole="button"
        className={cn(
          "h-32 w-32 items-center justify-center overflow-hidden border border-border bg-secondary",
          rounded,
        )}
      >
        {uploading ? (
          <ActivityIndicator />
        ) : value ? (
          <Image
            source={{ uri: value }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <Text className="px-2 text-center text-sm text-muted-foreground">
            Tap to add
          </Text>
        )}
      </Pressable>

      <View className="flex-row gap-5">
        <Pressable onPress={choose} disabled={uploading} hitSlop={8}>
          <Text className="font-poppins-medium text-primary">
            {value ? "Change" : "Upload"}
          </Text>
        </Pressable>
        {value ? (
          <Pressable
            onPress={() => onChange(null)}
            disabled={uploading}
            hitSlop={8}
          >
            <Text className="font-poppins-medium text-destructive">Remove</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

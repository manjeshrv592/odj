import { View, ActivityIndicator } from "react-native";

/**
 * Root landing. Approved users are redirected to their role's tab home by
 * `SessionGate` (see `_layout.tsx`); this is just the transient spinner shown
 * while that routing resolves.
 */
export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator />
    </View>
  );
}

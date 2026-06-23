import * as React from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import * as Location from "expo-location";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Field } from "@/components/ui/field";

export interface LocationValue {
  city: string;
  state: string;
  lat?: number | null;
  lng?: number | null;
}

/**
 * City/State capture. Asks location permission (with a clear rationale already
 * declared in app.json), then reverse-geocodes the device position to city +
 * state. Both fields stay editable, and full manual entry works when permission
 * is denied. lat/lng are captured when available (handy for future search).
 */
export function LocationPicker({
  value,
  onChange,
}: {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
}) {
  const [detecting, setDetecting] = React.useState(false);

  async function detect() {
    setDetecting(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Location off",
          "No problem — enter your city and state manually below.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      onChange({
        city: place?.city ?? place?.subregion ?? value.city,
        state: place?.region ?? value.state,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    } catch {
      Alert.alert(
        "Couldn't detect location",
        "Please enter your city and state manually.",
      );
    } finally {
      setDetecting(false);
    }
  }

  return (
    <View className="gap-4">
      <Button variant="outline" onPress={detect} disabled={detecting}>
        {detecting ? (
          <ActivityIndicator />
        ) : (
          <Text>📍 Use my current location</Text>
        )}
      </Button>
      <Text className="text-center text-sm text-muted-foreground">
        Helps show your profile to nearby hirers.
      </Text>

      <Field label="City" required>
        <Input
          value={value.city}
          onChangeText={(city) => onChange({ ...value, city })}
          placeholder="e.g. Bengaluru"
        />
      </Field>
      <Field label="State" required>
        <Input
          value={value.state}
          onChangeText={(state) => onChange({ ...value, state })}
          placeholder="e.g. Karnataka"
        />
      </Field>
    </View>
  );
}

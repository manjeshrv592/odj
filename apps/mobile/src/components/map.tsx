import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import {
  Map as MapLibreMap,
  Camera,
  Marker,
} from "@maplibre/maplibre-react-native";

/**
 * Free, key-less basemap tiles (OpenFreeMap) — no Google Cloud, no billing, no
 * API key. Good for dev/MVP; swap to a paid/self-hosted style for production.
 */
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export type MapPoint = { lat: number; lng: number };

/**
 * Thin wrapper over MapLibre showing a basemap centered on `center` with a pin
 * per `markers` entry. Reused for the worker location preview and (later) the
 * hirer search map. `style` should give it a height (defaults to filling parent).
 */
export function Map({
  center,
  markers = [],
  zoom = 13,
  style,
}: {
  center: MapPoint;
  markers?: MapPoint[];
  zoom?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <MapLibreMap mapStyle={MAP_STYLE_URL} style={style ?? { flex: 1 }}>
      <Camera zoom={zoom} center={[center.lng, center.lat]} />
      {markers.map((m, i) => (
        <Marker key={`${m.lat},${m.lng},${i}`} lngLat={[m.lng, m.lat]}>
          <View className="size-4 rounded-full border-2 border-white bg-primary" />
        </Marker>
      ))}
    </MapLibreMap>
  );
}

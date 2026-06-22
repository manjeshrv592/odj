// Expo + NativeWind babel config.
// `jsxImportSource: "nativewind"` lets className flow to RN components; the
// nativewind/babel preset compiles Tailwind classes. The Reanimated 4 /
// react-native-worklets babel plugin is injected automatically by
// babel-preset-expo on SDK 54+, so it must NOT be added here (would duplicate).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};

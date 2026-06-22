import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Cross-platform key/value storage.
 *
 * - **Native** (iOS/Android): `expo-secure-store` — encrypted, the real target.
 * - **Web**: `expo-secure-store` has no native module (calls like
 *   `getValueWithKeyAsync` don't exist), so we fall back to `localStorage` to
 *   keep browser previews working. Web is dev-preview only; do not treat it as
 *   secure storage.
 *
 * Exposes both surfaces consumers need: the synchronous `getItem`/`setItem`
 * (used by the better-auth Expo client) and the async `*Async` methods
 * (used for theme persistence).
 */
export interface AppStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

function createWebStorage(): AppStorage {
  const ls = typeof window !== "undefined" ? window.localStorage : undefined;
  return {
    getItem: (key) => ls?.getItem(key) ?? null,
    setItem: (key, value) => ls?.setItem(key, value),
    getItemAsync: async (key) => ls?.getItem(key) ?? null,
    setItemAsync: async (key, value) => {
      ls?.setItem(key, value);
    },
    deleteItemAsync: async (key) => {
      ls?.removeItem(key);
    },
  };
}

export const storage: AppStorage =
  Platform.OS === "web"
    ? createWebStorage()
    : {
        getItem: SecureStore.getItem,
        setItem: SecureStore.setItem,
        getItemAsync: SecureStore.getItemAsync,
        setItemAsync: SecureStore.setItemAsync,
        deleteItemAsync: SecureStore.deleteItemAsync,
      };

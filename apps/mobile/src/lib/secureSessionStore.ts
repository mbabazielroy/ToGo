import * as SecureStore from 'expo-secure-store';

// Storage adapter for the Supabase auth session on native.
//
// Security properties:
//  - Values are held by expo-secure-store, which uses the iOS Keychain and the
//    Android Keystore / EncryptedSharedPreferences. That is OS-level encrypted,
//    app-sandboxed storage — a very different tier from ordinary AsyncStorage,
//    which is unencrypted app-sandbox storage. Session tokens therefore never sit
//    in the same "ordinary demo storage" the demo mode uses.
//  - SecureStore caps a single value at ~2048 bytes, but a Supabase session
//    (access + refresh JWTs) can exceed that, so this adapter transparently chunks
//    a value across several keychain entries with a small `__parts` manifest.
//
// Works in Expo Go. No custom native code.
const CHUNK_SIZE = 1800; // safely under the ~2048-byte SecureStore limit
const partsKey = (key: string) => `${key}.__parts`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

export const secureSessionStore = {
  async getItem(key: string): Promise<string | null> {
    const partsRaw = await SecureStore.getItemAsync(partsKey(key));
    if (partsRaw == null) {
      // Legacy / small value stored directly under the key.
      return SecureStore.getItemAsync(key);
    }
    const parts = parseInt(partsRaw, 10);
    if (!Number.isFinite(parts) || parts <= 0) return null;
    let out = '';
    for (let i = 0; i < parts; i++) {
      const piece = await SecureStore.getItemAsync(chunkKey(key, i));
      if (piece == null) return null; // corrupt/partial — treat as absent
      out += piece;
    }
    return out;
  },

  async setItem(key: string, value: string): Promise<void> {
    // Clear any previous representation first.
    await secureSessionStore.removeItem(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const parts = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < parts; i++) {
      await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(partsKey(key), String(parts));
  },

  async removeItem(key: string): Promise<void> {
    const partsRaw = await SecureStore.getItemAsync(partsKey(key));
    if (partsRaw != null) {
      const parts = parseInt(partsRaw, 10) || 0;
      for (let i = 0; i < parts; i++) {
        await SecureStore.deleteItemAsync(chunkKey(key, i)).catch(() => {});
      }
      await SecureStore.deleteItemAsync(partsKey(key)).catch(() => {});
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

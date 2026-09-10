// Committed ambient reference so `tsc` picks up Expo's global types (including
// process.env.EXPO_PUBLIC_* typing) even when the generated, git-ignored
// expo-env.d.ts is absent (e.g. a fresh CI checkout before any expo command runs).
/// <reference types="expo/types" />

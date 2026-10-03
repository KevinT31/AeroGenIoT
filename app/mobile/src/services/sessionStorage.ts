import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { AuthSession, UserProfile } from "../types/aerogen";

const ACCESS_TOKEN_KEY = "aurora.session.access";
const REFRESH_TOKEN_KEY = "aurora.session.refresh";
const USER_KEY = "aurora.session.user";
const PROFILE_KEY = "aurora.profile";
const DEVICE_KEY = "aurora.device.active";
const SNAPSHOT_KEY = "aurora.snapshot.cache";
const EVENT_QUEUE_KEY = "aurora.events.queue";

const readJson = async <T,>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = async (key: string, value: unknown) => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

export const sessionStorage = {
  async loadSession(): Promise<AuthSession | null> {
    const [accessToken, refreshToken, user] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      readJson<AuthSession["user"] | null>(USER_KEY, null),
    ]);
    if (!accessToken || !refreshToken || !user) return null;
    return { accessToken, refreshToken, user };
  },

  async saveSession(session: AuthSession) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken),
      writeJson(USER_KEY, session.user),
    ]);
  },

  async clearSession() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
  },

  loadProfile(defaultProfile: UserProfile) {
    return readJson<UserProfile>(PROFILE_KEY, defaultProfile);
  },

  saveProfile(profile: UserProfile) {
    return writeJson(PROFILE_KEY, profile);
  },

  async loadActiveDeviceId(fallback: string) {
    return (await AsyncStorage.getItem(DEVICE_KEY)) || fallback;
  },

  saveActiveDeviceId(deviceId: string) {
    return AsyncStorage.setItem(DEVICE_KEY, deviceId);
  },

  loadSnapshot<T>(fallback: T) {
    return readJson<T>(SNAPSHOT_KEY, fallback);
  },

  saveSnapshot(snapshot: unknown) {
    return writeJson(SNAPSHOT_KEY, snapshot);
  },

  loadEventQueue<T>() {
    return readJson<T[]>(EVENT_QUEUE_KEY, []);
  },

  saveEventQueue(events: unknown[]) {
    return writeJson(EVENT_QUEUE_KEY, events.slice(-100));
  },
};

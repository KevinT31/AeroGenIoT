import axios from "axios";
import { ENV } from "../config/env";
import {
  AlertApiItem,
  AuthSession,
  DeviceSummary,
  LatestReadingApi,
  OperationalAiSnapshot,
  UserProfile,
} from "../types/aerogen";

let accessToken: string | null = null;

export const setApiAccessToken = (token: string | null) => {
  accessToken = token;
};

export const hasApiAccessToken = () => Boolean(accessToken);

const client = axios.create({
  baseURL: ENV.hasRemoteApi ? `${ENV.apiBase}/api/v1` : undefined,
  timeout: ENV.requestTimeoutMs,
});

client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export const backendApi = {
  hasConfiguredApi: ENV.hasRemoteApi,

  async login(email: string, password: string): Promise<AuthSession> {
    const response = await client.post<AuthSession>("/auth/login", { email, password });
    return response.data;
  },

  async register(name: string, email: string, password: string): Promise<AuthSession> {
    const response = await client.post<AuthSession>("/auth/register", { name, email, password });
    return response.data;
  },

  async refresh(refreshToken: string): Promise<AuthSession> {
    const response = await client.post<AuthSession>("/auth/refresh", { refreshToken });
    return response.data;
  },

  async logout(): Promise<void> {
    if (!ENV.hasRemoteApi || !accessToken) return;
    await client.post("/auth/logout");
  },

  async fetchLatestReadingRaw(deviceId: string): Promise<LatestReadingApi | null> {
    if (!ENV.hasRemoteApi) return null;
    const response = await client.get<LatestReadingApi | null>("/readings/latest", {
      params: { deviceId },
    });
    return response.data;
  },

  async fetchRecentAlertsRaw(deviceId: string): Promise<AlertApiItem[]> {
    if (!ENV.hasRemoteApi) return [];
    const response = await client.get<AlertApiItem[]>("/alerts/recent", {
      params: { deviceId },
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  async fetchOperationalAiRaw(deviceId: string): Promise<OperationalAiSnapshot | null> {
    if (!ENV.hasRemoteApi) return null;
    const response = await client.get<OperationalAiSnapshot | null>("/ai/operational", {
      params: { deviceId },
    });
    return response.data ?? null;
  },

  async ackAlertRaw(alertId: string): Promise<AlertApiItem | null> {
    if (!ENV.hasRemoteApi) return null;
    const response = await client.post<AlertApiItem>(`/alerts/${alertId}/ack`);
    return response.data || null;
  },

  async fetchDevicesRaw(): Promise<DeviceSummary[]> {
    if (!ENV.hasRemoteApi) return [];
    const response = await client.get<DeviceSummary[]>("/devices");
    return Array.isArray(response.data) ? response.data : [];
  },

  async fetchBootstrapRaw(): Promise<any | null> {
    if (!ENV.hasRemoteApi) return null;
    const response = await client.get("/me/bootstrap");
    return response.data || null;
  },

  async updatePreferencesRaw(preferences: Record<string, unknown>): Promise<void> {
    if (!ENV.hasRemoteApi) return;
    await client.put("/users/preferences", preferences);
  },

  async sendAppEventRaw(event: {
    event: string;
    category?: "session" | "screen" | "interaction" | "network" | "crash";
    deviceId?: string;
    platform?: string;
    appVersion?: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    if (!ENV.hasRemoteApi || !accessToken) throw new Error("App event auth unavailable");
    await client.post("/app-events", event);
  },
};

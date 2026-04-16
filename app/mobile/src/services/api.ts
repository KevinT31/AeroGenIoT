import axios from "axios";
import { ENV } from "../config/env";
import { AlertApiItem, LatestReadingApi, OperationalAiSnapshot } from "../types/aerogen";

const client = axios.create({
  baseURL: ENV.hasRemoteApi ? `${ENV.apiBase}/api/v1` : undefined,
  timeout: ENV.requestTimeoutMs,
});

export const backendApi = {
  hasConfiguredApi: ENV.hasRemoteApi,

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
};

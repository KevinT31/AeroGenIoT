import axios from "axios";
import { ENV } from "../config/env";
import { AlertItem, LatestReading } from "../types/aerogen";

const base = ENV.apiBase;

const client = axios.create({
  baseURL: `${base}/api/v1`,
  timeout: 12000,
});

export const hasApiBase = Boolean(base);

export const fetchLatestReading = async (deviceId: string): Promise<LatestReading | null> => {
  if (!hasApiBase) return null;
  const response = await client.get<LatestReading | null>("/readings/latest", {
    params: { deviceId },
  });
  return response.data;
};

export const fetchRecentAlerts = async (deviceId: string): Promise<AlertItem[]> => {
  if (!hasApiBase) return [];
  const response = await client.get<AlertItem[]>("/alerts/recent", {
    params: { deviceId },
  });
  return Array.isArray(response.data) ? response.data : [];
};

import { ENV } from "../config/env";
import { AlertItem } from "../types/aerogen";
import { backendApi } from "./api";
import { normalizeAlert, normalizeAlerts } from "./adapters/aerogenAdapter";
import { acknowledgeMockAlert, buildMockAlerts } from "./mockData";

export const alertsService = {
  async listRecent(deviceId: string): Promise<AlertItem[]> {
    if (ENV.useMockData) {
      return buildMockAlerts(deviceId);
    }

    const raw = await backendApi.fetchRecentAlertsRaw(deviceId);
    return normalizeAlerts(raw);
  },

  async acknowledge(alertId: string): Promise<AlertItem | null> {
    if (ENV.useMockData) {
      return acknowledgeMockAlert(alertId);
    }

    const raw = await backendApi.ackAlertRaw(alertId);
    return raw ? normalizeAlert(raw) : null;
  },
};

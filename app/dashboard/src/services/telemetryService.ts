import { ENV } from "@/config/env";
import { TelemetryPoint, TimeRange } from "@/types/dashboard";
import { apiClient } from "./apiClient";
import { normalizeHistoryPoint, normalizeLatestReading } from "./adapters/aerogenAdapter";
import { buildMockLatest, createSyntheticHistory } from "./mockData";

export const telemetryService = {
  async getLatest(): Promise<TelemetryPoint | null> {
    if (ENV.useMockData || !apiClient.hasApi) {
      return buildMockLatest();
    }

    const response = await apiClient.get<any>("/readings/latest", {
      params: { deviceId: ENV.deviceId },
    });

    return normalizeLatestReading(response);
  },

  async getHistory(range: TimeRange, latest: TelemetryPoint | null): Promise<TelemetryPoint[]> {
    if (ENV.useMockData || !apiClient.hasApi) {
      return createSyntheticHistory(latest || buildMockLatest(), range);
    }

    try {
      const response = await apiClient.get<any[]>("/readings", {
        params: {
          deviceId: ENV.deviceId || undefined,
          farmId: ENV.farmId || undefined,
          plotId: ENV.plotId || undefined,
        },
        auth: Boolean(ENV.accessToken),
      });

      const points = response
        .map(normalizeHistoryPoint)
        .filter((point): point is TelemetryPoint => Boolean(point))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (points.length) {
        return trimHistory(points, range);
      }
    } catch {
      // Fallback to synthetic trend if the public/protected route is unavailable.
    }

    return createSyntheticHistory(latest || buildMockLatest(), range);
  },
};

const trimHistory = (points: TelemetryPoint[], range: TimeRange) => {
  const now = Date.now();
  const windowMs: Record<TimeRange, number> = {
    "1h": 60 * 60_000,
    "6h": 6 * 60 * 60_000,
    "24h": 24 * 60 * 60_000,
    "7d": 7 * 24 * 60 * 60_000,
  };

  const cutoff = now - windowMs[range];
  const filtered = points.filter((point) => new Date(point.timestamp).getTime() >= cutoff);
  return filtered.length ? filtered : points.slice(-24);
};

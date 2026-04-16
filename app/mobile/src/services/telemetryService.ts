import { ENV } from "../config/env";
import { TelemetryReading } from "../types/aerogen";
import { backendApi } from "./api";
import { normalizeReading } from "./adapters/aerogenAdapter";
import { buildMockReading } from "./mockData";

export const telemetryService = {
  async getLatest(deviceId: string): Promise<TelemetryReading | null> {
    if (ENV.useMockData) {
      return buildMockReading(deviceId);
    }

    const raw = await backendApi.fetchLatestReadingRaw(deviceId);
    return normalizeReading(raw);
  },
};

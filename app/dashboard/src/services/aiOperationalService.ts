import { ENV } from "@/config/env";
import {
  AiOperationalSnapshot,
  FaultPrediction,
  PowerForecast,
  TelemetryPoint,
  YawRecommendation,
} from "@/types/dashboard";
import { apiClient } from "./apiClient";

const CACHE_TTL_MS = 30_000;

let cache:
  | {
      deviceId: string;
      expiresAt: number;
      value: AiOperationalSnapshot | null;
    }
  | null = null;

const pickFaultPrediction = (latest: TelemetryPoint): FaultPrediction => {
  if ((latest.genTempC ?? 0) >= 60) {
    return {
      deviceId: ENV.deviceId,
      label: "high_temp",
      confidencePct: 92,
      severity: (latest.genTempC ?? 0) >= 70 ? "critical" : "warning",
      recommendedAction: null,
      timestamp: latest.timestamp,
    };
  }

  if ((latest.vibrationRms ?? 0) >= 4) {
    return {
      deviceId: ENV.deviceId,
      label: "high_vibration",
      confidencePct: 88,
      severity: (latest.vibrationRms ?? 0) >= 7 ? "critical" : "warning",
      recommendedAction: null,
      timestamp: latest.timestamp,
    };
  }

  if ((latest.batteryPct ?? 100) < 20) {
    return {
      deviceId: ENV.deviceId,
      label: "low_battery",
      confidencePct: 84,
      severity: (latest.batteryPct ?? 100) <= 10 ? "critical" : "warning",
      recommendedAction: null,
      timestamp: latest.timestamp,
    };
  }

  return {
    deviceId: ENV.deviceId,
    label: "nominal_operation",
    confidencePct: 78,
    severity: "info",
    recommendedAction: null,
    timestamp: latest.timestamp,
  };
};

const pickPowerForecast = (latest: TelemetryPoint): PowerForecast => {
  const windPower = Math.max(0, (latest.windSpeedMs ?? 0) * 115);
  const fallback = latest.loadPowerW ?? latest.powerW ?? 0;
  const predictedPowerW = Number(Math.max(windPower, fallback).toFixed(1));
  const spread = Math.max(60, predictedPowerW * 0.18);

  return {
    deviceId: ENV.deviceId,
    predictedPowerW,
    lowerBoundW: Number(Math.max(0, predictedPowerW - spread).toFixed(1)),
    upperBoundW: Number((predictedPowerW + spread).toFixed(1)),
    horizonMinutes: 15,
    timestamp: latest.timestamp,
  };
};

const pickYawRecommendation = (latest: TelemetryPoint): YawRecommendation => ({
  deviceId: ENV.deviceId,
  targetYawDeg: latest.windDirectionDeg,
  action: null,
  confidencePct: latest.windDirectionDeg === null ? null : 90,
  reason: null,
  timestamp: latest.timestamp,
});

const buildMockSnapshot = (latest: TelemetryPoint | null): AiOperationalSnapshot | null => {
  if (!latest) return null;
  const faultPrediction = pickFaultPrediction(latest);
  const powerForecast = pickPowerForecast(latest);
  const yawRecommendation = pickYawRecommendation(latest);

  return {
    deviceId: ENV.deviceId,
    updatedAt: latest.timestamp,
    faultPrediction,
    powerForecast,
    yawRecommendation,
  };
};

export const aiOperationalService = {
  async getSnapshot(
    latest: TelemetryPoint | null,
    options?: { force?: boolean },
  ): Promise<AiOperationalSnapshot | null> {
    if (ENV.useMockData || !apiClient.hasApi) {
      return buildMockSnapshot(latest);
    }

    if (
      !options?.force &&
      cache &&
      cache.deviceId === ENV.deviceId &&
      cache.expiresAt > Date.now()
    ) {
      return cache.value;
    }

    try {
      const value = await apiClient.get<AiOperationalSnapshot>("/ai/operational", {
        params: { deviceId: ENV.deviceId },
      });
      cache = {
        deviceId: ENV.deviceId,
        expiresAt: Date.now() + CACHE_TTL_MS,
        value,
      };
      return value;
    } catch {
      cache = {
        deviceId: ENV.deviceId,
        expiresAt: Date.now() + 10_000,
        value: null,
      };
      return null;
    }
  },

  invalidate() {
    cache = null;
  },
};

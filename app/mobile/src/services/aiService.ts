import { ENV } from "../config/env";
import {
  FaultPrediction,
  OperationalAiSnapshot,
  PowerForecast,
  TelemetryReading,
  YawRecommendation,
} from "../types/aerogen";
import { backendApi } from "./api";

const CACHE_TTL_MS = 30_000;

let cache:
  | {
      deviceId: string;
      expiresAt: number;
      value: OperationalAiSnapshot | null;
    }
  | null = null;

const buildMockFault = (reading: TelemetryReading): FaultPrediction => {
  if ((reading.genTempC ?? 0) >= 60) {
    return {
      deviceId: ENV.deviceId,
      label: "high_temp",
      confidencePct: 92,
      severity: (reading.genTempC ?? 0) >= 70 ? "critical" : "warning",
      recommendedAction: null,
      timestamp: reading.ts,
    };
  }

  if ((reading.vibrationRms ?? 0) >= 4) {
    return {
      deviceId: ENV.deviceId,
      label: "high_vibration",
      confidencePct: 88,
      severity: (reading.vibrationRms ?? 0) >= 7 ? "critical" : "warning",
      recommendedAction: null,
      timestamp: reading.ts,
    };
  }

  if ((reading.batteryPct ?? 100) < 20) {
    return {
      deviceId: ENV.deviceId,
      label: "low_battery",
      confidencePct: 84,
      severity: (reading.batteryPct ?? 100) <= 10 ? "critical" : "warning",
      recommendedAction: null,
      timestamp: reading.ts,
    };
  }

  return {
    deviceId: ENV.deviceId,
    label: "nominal_operation",
    confidencePct: 78,
    severity: "info",
    recommendedAction: null,
    timestamp: reading.ts,
  };
};

const buildMockPower = (reading: TelemetryReading): PowerForecast => {
  const windPower = Math.max(0, (reading.windSpeedMs ?? 0) * 115);
  const fallback = reading.loadPowerW ?? reading.powerW ?? 0;
  const predictedPowerW = Number(Math.max(windPower, fallback).toFixed(1));
  const spread = Math.max(60, predictedPowerW * 0.18);

  return {
    deviceId: ENV.deviceId,
    predictedPowerW,
    lowerBoundW: Number(Math.max(0, predictedPowerW - spread).toFixed(1)),
    upperBoundW: Number((predictedPowerW + spread).toFixed(1)),
    horizonMinutes: 15,
    timestamp: reading.ts,
  };
};

const buildMockYaw = (reading: TelemetryReading): YawRecommendation => ({
  deviceId: ENV.deviceId,
  targetYawDeg: reading.windDirectionDeg,
  action: null,
  confidencePct: reading.windDirectionDeg === null ? null : 90,
  reason: null,
  timestamp: reading.ts,
});

const buildMockSnapshot = (reading: TelemetryReading | null): OperationalAiSnapshot | null => {
  if (!reading) return null;

  return {
    deviceId: ENV.deviceId,
    updatedAt: reading.ts,
    faultPrediction: buildMockFault(reading),
    powerForecast: buildMockPower(reading),
    yawRecommendation: buildMockYaw(reading),
  };
};

export const aiService = {
  async getOperational(
    deviceId: string,
    reading: TelemetryReading | null,
    options?: { force?: boolean },
  ): Promise<OperationalAiSnapshot | null> {
    if (ENV.useMockData) {
      return buildMockSnapshot(reading);
    }

    if (
      !options?.force &&
      cache &&
      cache.deviceId === deviceId &&
      cache.expiresAt > Date.now()
    ) {
      return cache.value;
    }

    try {
      const value = await backendApi.fetchOperationalAiRaw(deviceId);
      cache = {
        deviceId,
        expiresAt: Date.now() + CACHE_TTL_MS,
        value,
      };
      return value;
    } catch {
      cache = {
        deviceId,
        expiresAt: Date.now() + 10_000,
        value: null,
      };
      return null;
    }
  },
};

export type SourceNow = "WIND" | "BATTERY" | "BOTH";
export type SystemLevel = "ok" | "warn" | "stop";

export interface LatestReading {
  id: string;
  deviceId: string;
  farmId?: string | null;
  plotId?: string | null;
  ts: string;
  windSpeedMs?: number | null;
  genVoltageV?: number | null;
  genCurrentA?: number | null;
  powerW?: number | null;
  loadPowerW?: number | null;
  sourceNow?: SourceNow | null;
  sourceReason?: string | null;
  vibrationRms?: number | null;
  genTempC?: number | null;
  batteryPct?: number | null;
  energyTodayKwh?: number | null;
  mode?: string | null;
  createdAt?: string | null;
}

export interface AlertItem {
  id: string;
  deviceId?: string | null;
  farmId?: string | null;
  plotId?: string | null;
  type: string;
  status: "open" | "acknowledged" | "resolved";
  message: string;
  createdAt: string;
  updatedAt: string;
}

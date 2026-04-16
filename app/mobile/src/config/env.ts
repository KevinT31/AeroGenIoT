const toNumber = (raw: string | undefined, fallback: number) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (raw: string | undefined, fallback = false) => {
  if (raw === undefined) return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const normalizeBase = (value: string | undefined) => String(value || "").trim().replace(/\/+$/, "");

const apiBase = normalizeBase(process.env.EXPO_PUBLIC_API_BASE);

export const ENV = {
  apiBase,
  hasRemoteApi: Boolean(apiBase),
  deviceId: String(process.env.EXPO_PUBLIC_DEVICE_ID || "AE-01"),
  pollMs: Math.max(1000, toNumber(process.env.EXPO_PUBLIC_POLL_MS, 5000)),
  requestTimeoutMs: Math.max(3000, toNumber(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT_MS, 12000)),
  staleAfterMs: Math.max(15000, toNumber(process.env.EXPO_PUBLIC_STALE_AFTER_MS, 90000)),
  supportPhone: String(process.env.EXPO_PUBLIC_SUPPORT_PHONE || "+573000000000"),
  batteryCapacityKwh: Math.max(0.1, toNumber(process.env.EXPO_PUBLIC_BATTERY_KWH, 3)),
  useMockData: toBoolean(process.env.EXPO_PUBLIC_USE_MOCK, false),
  realtimeEnabled: toBoolean(process.env.EXPO_PUBLIC_REALTIME_ENABLED, true),
  cloudProfile: String(process.env.EXPO_PUBLIC_CLOUD_PROFILE || "current"),
};

export type AppEnv = typeof ENV;

const toNumber = (raw: string | undefined, fallback: number) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (raw: string | undefined, fallback: boolean) => {
  if (raw === undefined) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const normalizeBase = (value: string | undefined) => String(value || "").trim().replace(/\/+$/, "");

export const ENV = {
  appName: "Aurora Noctua",
  apiBase: normalizeBase(import.meta.env.VITE_API_BASE),
  deviceId: String(import.meta.env.VITE_DEVICE_ID || "AE-01"),
  farmId: String(import.meta.env.VITE_FARM_ID || ""),
  plotId: String(import.meta.env.VITE_PLOT_ID || ""),
  requestTimeoutMs: Math.max(3000, toNumber(import.meta.env.VITE_REQUEST_TIMEOUT_MS, 12000)),
  pollMs: Math.max(1000, toNumber(import.meta.env.VITE_POLL_MS, 5000)),
  staleAfterMs: Math.max(15000, toNumber(import.meta.env.VITE_STALE_AFTER_MS, 90000)),
  realtimeEnabled: toBoolean(import.meta.env.VITE_REALTIME_ENABLED, true),
  useMockData: toBoolean(import.meta.env.VITE_USE_MOCK, false),
  accessToken: String(import.meta.env.VITE_ACCESS_TOKEN || ""),
  cloudProfile: String(import.meta.env.VITE_CLOUD_PROFILE || "current"),
  defaultTheme: String(import.meta.env.VITE_DEFAULT_THEME || "dark"),
};

export const hasConfiguredApi = Boolean(ENV.apiBase);

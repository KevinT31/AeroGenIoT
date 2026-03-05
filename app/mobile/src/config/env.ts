const toNumber = (raw: string | undefined, fallback: number) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeBase = (value: string | undefined) => String(value || "").trim().replace(/\/+$/, "");

export const ENV = {
  apiBase: normalizeBase(process.env.EXPO_PUBLIC_API_BASE),
  deviceId: String(process.env.EXPO_PUBLIC_DEVICE_ID || "AE-01"),
  pollMs: Math.max(1000, toNumber(process.env.EXPO_PUBLIC_POLL_MS, 5000)),
  supportPhone: String(process.env.EXPO_PUBLIC_SUPPORT_PHONE || "+573000000000"),
  batteryCapacityKwh: Math.max(0.1, toNumber(process.env.EXPO_PUBLIC_BATTERY_KWH, 3)),
};

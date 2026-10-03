import { Platform } from "react-native";
import { ENV } from "../config/env";
import { backendApi } from "./api";
import { sessionStorage } from "./sessionStorage";

type AppEvent = {
  event: string;
  category?: "session" | "screen" | "interaction" | "network" | "crash";
  deviceId?: string;
  platform?: string;
  appVersion?: string;
  payload?: Record<string, unknown>;
};

const appVersion = "1.0.1";

const safePayload = (payload?: Record<string, unknown>) => {
  if (!payload) return undefined;
  const reduced: Record<string, unknown> = {};
  Object.entries(payload).slice(0, 20).forEach(([key, value]) => {
    if (typeof value === "string") reduced[key] = value.slice(0, 500);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) reduced[key] = value;
    else reduced[key] = JSON.stringify(value).slice(0, 500);
  });
  return reduced;
};

const normalizeEvent = (event: AppEvent): AppEvent => ({
  ...event,
  deviceId: event.deviceId || ENV.deviceId,
  platform: Platform.OS,
  appVersion,
  payload: safePayload(event.payload),
});

export const analyticsService = {
  async track(event: AppEvent) {
    const normalized = normalizeEvent(event);
    const queue = await sessionStorage.loadEventQueue<AppEvent>();
    await sessionStorage.saveEventQueue([...queue, normalized]);
    await this.flush();
  },

  async captureError(error: unknown, context?: Record<string, unknown>) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    await this.track({
      event: "mobile_error",
      category: "crash",
      payload: {
        message,
        stack,
        ...context,
      },
    });
  },

  async flush() {
    const queue = await sessionStorage.loadEventQueue<AppEvent>();
    if (!queue.length) return;
    const pending: AppEvent[] = [];
    for (const event of queue) {
      try {
        await backendApi.sendAppEventRaw(event);
      } catch {
        pending.push(event);
      }
    }
    await sessionStorage.saveEventQueue(pending);
  },
};

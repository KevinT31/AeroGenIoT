import { io, Socket } from "socket.io-client";
import { ENV, hasConfiguredApi } from "@/config/env";
import { DashboardLanguage } from "@/i18n/translations";
import { AlarmItem, TelemetryPoint } from "@/types/dashboard";
import { normalizeAlarm, normalizeLatestReading } from "./adapters/aerogenAdapter";

type RealtimeHandlers = {
  onConnection?: (connected: boolean) => void;
  onReading?: (reading: TelemetryPoint) => void;
  onAlarm?: (alarm: AlarmItem) => void;
};

export const realtimeService = {
  connect(
    handlers: RealtimeHandlers,
    language: DashboardLanguage = "en",
  ) {
    if (!ENV.realtimeEnabled || ENV.useMockData || !hasConfiguredApi) {
      handlers.onConnection?.(false);
      return { disconnect: () => undefined };
    }

    const socket: Socket = io(`${ENV.apiBase}/realtime`, {
      transports: ["websocket"],
      reconnection: true,
      timeout: ENV.requestTimeoutMs,
    });

    socket.on("connect", () => {
      handlers.onConnection?.(true);
      socket.emit("subscribe", { deviceId: ENV.deviceId });
    });

    socket.on("disconnect", () => {
      handlers.onConnection?.(false);
    });

    socket.on("reading.new", (payload) => {
      const reading = normalizeLatestReading(payload);
      if (reading) handlers.onReading?.(reading);
    });

    socket.on("alert.new", (payload) => {
      handlers.onAlarm?.(normalizeAlarm(payload, language));
    });

    socket.on("alert.updated", (payload) => {
      handlers.onAlarm?.(normalizeAlarm(payload, language));
    });

    return {
      disconnect: () => {
        socket.removeAllListeners();
        socket.disconnect();
      },
    };
  },
};

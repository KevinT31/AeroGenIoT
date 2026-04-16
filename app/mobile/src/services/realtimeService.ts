import { io, Socket } from "socket.io-client";
import { ENV } from "../config/env";
import { AlertItem, TelemetryReading } from "../types/aerogen";
import { normalizeAlert, normalizeReading } from "./adapters/aerogenAdapter";

type RealtimeHandlers = {
  deviceId: string;
  onConnectionChange?: (connected: boolean) => void;
  onReading?: (reading: TelemetryReading) => void;
  onAlert?: (alert: AlertItem) => void;
  onAlertUpdate?: (alert: AlertItem) => void;
};

type RealtimeSubscription = {
  disconnect: () => void;
};

const noopSubscription: RealtimeSubscription = {
  disconnect: () => undefined,
};

export const realtimeService = {
  connect(handlers: RealtimeHandlers): RealtimeSubscription {
    if (!ENV.realtimeEnabled || ENV.useMockData || !ENV.hasRemoteApi) {
      handlers.onConnectionChange?.(false);
      return noopSubscription;
    }

    const socket: Socket = io(`${ENV.apiBase}/realtime`, {
      transports: ["websocket"],
      timeout: ENV.requestTimeoutMs,
      reconnection: true,
    });

    socket.on("connect", () => {
      handlers.onConnectionChange?.(true);
      socket.emit("subscribe", { deviceId: handlers.deviceId });
    });

    socket.on("disconnect", () => {
      handlers.onConnectionChange?.(false);
    });

    socket.on("reading.new", (payload) => {
      const normalized = normalizeReading(payload);
      if (!normalized || normalized.deviceId !== handlers.deviceId) return;
      handlers.onReading?.(normalized);
    });

    socket.on("alert.new", (payload) => {
      const normalized = normalizeAlert(payload);
      if (!normalized) return;
      if (normalized.deviceId !== handlers.deviceId) return;
      handlers.onAlert?.(normalized);
    });

    socket.on("alert.updated", (payload) => {
      const normalized = normalizeAlert(payload);
      if (!normalized) return;
      if (normalized.deviceId !== handlers.deviceId) return;
      handlers.onAlertUpdate?.(normalized);
    });

    return {
      disconnect: () => {
        socket.removeAllListeners();
        socket.disconnect();
      },
    };
  },
};

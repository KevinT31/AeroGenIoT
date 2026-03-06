import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ENV } from "../config/env";
import { ackAlert, fetchLatestReading, fetchRecentAlerts, hasApiBase } from "../services/api";
import { AlertItem, LatestReading } from "../types/aerogen";
import { sortAlertsByDate } from "../utils/format";

type AeroContextShape = {
  reading: LatestReading | null;
  alerts: AlertItem[];
  loading: boolean;
  apiReachable: boolean;
  isConnectedRealtime: boolean;
  lastSyncAt: Date | null;
  ackedAlerts: Record<string, true>;
  markAlertReceived: (alertId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const AeroContext = createContext<AeroContextShape | null>(null);

export const AeroProvider = ({ children }: { children: React.ReactNode }) => {
  const [reading, setReading] = useState<LatestReading | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiReachable, setApiReachable] = useState<boolean>(true);
  const [isConnectedRealtime, setIsConnectedRealtime] = useState<boolean>(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [ackedAlerts, setAckedAlerts] = useState<Record<string, true>>({});
  const socketRef = useRef<Socket | null>(null);
  const initialAlertsClearedRef = useRef(false);

  const deviceId = ENV.deviceId;
  const apiBase = ENV.apiBase;

  const mergeAlert = useCallback((incoming: AlertItem) => {
    setAlerts((prev) => {
      const merged = [incoming, ...prev.filter((item) => item.id !== incoming.id)];
      return sortAlertsByDate(merged).slice(0, 100);
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!hasApiBase) {
      setApiReachable(false);
      setLoading(false);
      return;
    }

    try {
      const [latest, recentAlerts] = await Promise.all([fetchLatestReading(deviceId), fetchRecentAlerts(deviceId)]);
      const openAlerts = recentAlerts.filter((alert) => alert.status === "open");

      if (!initialAlertsClearedRef.current && openAlerts.length) {
        await Promise.all(openAlerts.map((alert) => ackAlert(alert.id).catch(() => null)));
      }

      const effectiveAlerts =
        !initialAlertsClearedRef.current && openAlerts.length ? await fetchRecentAlerts(deviceId) : recentAlerts;

      initialAlertsClearedRef.current = true;
      setReading(latest);
      setAlerts(sortAlertsByDate(effectiveAlerts));
      setApiReachable(true);
      setLastSyncAt(new Date());
    } catch {
      setApiReachable(false);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, ENV.pollMs);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!apiBase) return;

    const socket = io(`${apiBase}/realtime`, {
      transports: ["websocket"],
      timeout: 12000,
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnectedRealtime(true);
      socket.emit("subscribe", { deviceId });
    });

    socket.on("disconnect", () => {
      setIsConnectedRealtime(false);
    });

    socket.on("reading.new", (payload: LatestReading) => {
      if (!payload || payload.deviceId !== deviceId) return;
      setReading(payload);
      setLastSyncAt(new Date());
      setApiReachable(true);
    });

    socket.on("alert.new", (payload: AlertItem) => {
      if (!payload || payload.deviceId !== deviceId) return;
      mergeAlert(payload);
      setLastSyncAt(new Date());
      setApiReachable(true);
    });

    socket.on("alert.updated", (payload: AlertItem) => {
      if (!payload || payload.deviceId !== deviceId) return;
      mergeAlert(payload);
      setLastSyncAt(new Date());
      setApiReachable(true);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [apiBase, deviceId, mergeAlert]);

  const markAlertReceived = useCallback(async (alertId: string) => {
    try {
      const updated = await ackAlert(alertId);
      if (updated) {
        mergeAlert(updated);
      }
    } catch {
      // Keep local acknowledgement for offline/failure cases.
    }
    setAckedAlerts((prev) => ({ ...prev, [alertId]: true }));
  }, [mergeAlert]);

  const value = useMemo<AeroContextShape>(
    () => ({
      reading,
      alerts,
      loading,
      apiReachable,
      isConnectedRealtime,
      lastSyncAt,
      ackedAlerts,
      markAlertReceived,
      refresh,
    }),
    [reading, alerts, loading, apiReachable, isConnectedRealtime, lastSyncAt, ackedAlerts, markAlertReceived, refresh],
  );

  return <AeroContext.Provider value={value}>{children}</AeroContext.Provider>;
};

export const useAero = () => {
  const value = useContext(AeroContext);
  if (!value) throw new Error("useAero must be used inside AeroProvider");
  return value;
};

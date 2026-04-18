import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ENV } from "../config/env";
import { aiService } from "../services/aiService";
import { alertsService } from "../services/alertsService";
import { deviceStatusService } from "../services/deviceStatusService";
import { realtimeService } from "../services/realtimeService";
import { telemetryService } from "../services/telemetryService";
import { AlertItem, DataMode, OperationalAiSnapshot, SyncState, TelemetryReading } from "../types/aerogen";
import { sortAlertsByDate } from "../utils/format";

type AeroContextShape = {
  reading: TelemetryReading | null;
  aiOperational: OperationalAiSnapshot | null;
  alerts: AlertItem[];
  pendingAlerts: AlertItem[];
  loading: boolean;
  refreshing: boolean;
  syncState: SyncState;
  hasData: boolean;
  dataMode: DataMode;
  isConnectedRealtime: boolean;
  isRealtimeEnabled: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
  refresh: () => Promise<void>;
  markAlertReceived: (alertId: string) => Promise<boolean>;
};

const AeroContext = createContext<AeroContextShape | null>(null);

const extractErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  return "Unknown error";
};

const mergeAlertItem = (prev: AlertItem[], incoming: AlertItem) => {
  const merged = [incoming, ...prev.filter((item) => item.id !== incoming.id)];
  return sortAlertsByDate(merged).slice(0, 100);
};

export const AeroProvider = ({ children }: { children: React.ReactNode }) => {
  const [reading, setReading] = useState<TelemetryReading | null>(null);
  const [aiOperational, setAiOperational] = useState<OperationalAiSnapshot | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [isConnectedRealtime, setIsConnectedRealtime] = useState<boolean>(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);
  const [lastFetchFailed, setLastFetchFailed] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const deviceId = ENV.deviceId;
  const dataMode: DataMode = ENV.useMockData ? "mock" : "live";

  const updateLastSync = useCallback(() => {
    setLastSyncAt(new Date());
    setLastFetchFailed(false);
    setLastError(null);
  }, []);

  const mergeAlert = useCallback((incoming: AlertItem) => {
    setAlerts((prev) => mergeAlertItem(prev, incoming));
  }, []);

  const loadSnapshot = useCallback(
    async (mode: "initial" | "manual" | "poll") => {
      if (mode === "initial") setLoading(true);
      if (mode === "manual") setRefreshing(true);

      try {
        const [latest, recentAlerts] = await Promise.all([
          telemetryService.getLatest(deviceId),
          alertsService.listRecent(deviceId),
        ]);
        const operationalAi = await aiService.getOperational(deviceId, latest, {
          force: mode !== "poll",
        });

        setReading(latest);
        setAiOperational(operationalAi);
        setAlerts(sortAlertsByDate(recentAlerts).slice(0, 100));
        updateLastSync();
      } catch (error) {
        setLastFetchFailed(true);
        setLastError(extractErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
        setHasLoadedOnce(true);
      }
    },
    [deviceId, updateLastSync],
  );

  useEffect(() => {
    void loadSnapshot("initial");
    const timer = setInterval(() => {
      void loadSnapshot("poll");
    }, ENV.pollMs);
    return () => clearInterval(timer);
  }, [loadSnapshot]);

  useEffect(() => {
    const subscription = realtimeService.connect({
      deviceId,
      onConnectionChange: setIsConnectedRealtime,
      onReading: (incoming) => {
        setReading(incoming);
        updateLastSync();
      },
      onAlert: (incoming) => {
        mergeAlert(incoming);
        updateLastSync();
      },
      onAlertUpdate: (incoming) => {
        mergeAlert(incoming);
        updateLastSync();
      },
    });

    return () => {
      subscription.disconnect();
    };
  }, [deviceId, mergeAlert, updateLastSync]);

  const refresh = useCallback(async () => {
    await loadSnapshot("manual");
  }, [loadSnapshot]);

  const markAlertReceived = useCallback(async (alertId: string) => {
    if (alertId.startsWith("telemetry:") || alertId.startsWith("ai:")) {
      setAlerts((prev) =>
        sortAlertsByDate(
          prev.map((alert) =>
            alert.id === alertId
              ? {
                  ...alert,
                  status: "acknowledged",
                  updatedAt: new Date().toISOString(),
                }
              : alert,
          ),
        ),
      );
      return true;
    }

    try {
      const updated = await alertsService.acknowledge(alertId);
      if (!updated) return false;
      mergeAlert(updated);
      return true;
    } catch (error) {
      setLastError(extractErrorMessage(error));
      return false;
    }
  }, [mergeAlert]);

  const pendingAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === "open"),
    [alerts],
  );

  const hasData = Boolean(reading || alerts.length || aiOperational);

  const syncState = useMemo(
    () =>
      deviceStatusService.resolveSyncState({
        apiConfigured: ENV.hasRemoteApi,
        useMockData: ENV.useMockData,
        hasLoadedOnce,
        hasData,
        reading,
        lastFetchFailed,
        staleAfterMs: ENV.staleAfterMs,
      }),
    [hasData, hasLoadedOnce, lastFetchFailed, reading],
  );

  const value = useMemo<AeroContextShape>(
    () => ({
      reading,
      aiOperational,
      alerts,
      pendingAlerts,
      loading,
      refreshing,
      syncState,
      hasData,
      dataMode,
      isConnectedRealtime,
      isRealtimeEnabled: ENV.realtimeEnabled,
      lastSyncAt,
      lastError,
      refresh,
      markAlertReceived,
    }),
    [
      alerts,
      aiOperational,
      dataMode,
      hasData,
      isConnectedRealtime,
      lastError,
      lastSyncAt,
      loading,
      markAlertReceived,
      pendingAlerts,
      reading,
      refresh,
      refreshing,
      syncState,
    ],
  );

  return <AeroContext.Provider value={value}>{children}</AeroContext.Provider>;
};

export const useAero = () => {
  const value = useContext(AeroContext);
  if (!value) throw new Error("useAero must be used inside AeroProvider");
  return value;
};

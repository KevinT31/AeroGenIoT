import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ENV } from "@/config/env";
import {
  DashboardLanguage,
  translateDashboard,
} from "@/i18n/translations";
import { alertsService } from "@/services/alertsService";
import { aiOperationalService } from "@/services/aiOperationalService";
import { deviceStatusService } from "@/services/deviceStatusService";
import { digitalTwinService } from "@/services/digitalTwinService";
import { maintenanceService } from "@/services/maintenanceService";
import { realtimeService } from "@/services/realtimeService";
import { telemetryService } from "@/services/telemetryService";
import { relocalizeAlarm } from "@/services/adapters/aerogenAdapter";
import {
  AlarmItem,
  DashboardSnapshot,
  DigitalTwinState,
  SystemHealthSnapshot,
  TelemetryPoint,
  TimeRange,
} from "@/types/dashboard";

type ThemeMode = "dark" | "light";

type DashboardContextShape = {
  snapshot: DashboardSnapshot;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  refresh: () => Promise<void>;
  acknowledgeAlarm: (alarmId: string) => Promise<void>;
  isLoading: boolean;
  isRefreshing: boolean;
  isRealtimeConnected: boolean;
  errorMessage: string | null;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  language: DashboardLanguage;
  toggleLanguage: () => void;
};

const buildEmptyHealth = (language: DashboardLanguage): SystemHealthSnapshot => ({
  deviceId: ENV.deviceId,
  timestamp: null,
  connectivityStatus: "empty",
  overallStatus: "offline",
  healthScore: 0,
  activeAlertsCount: 0,
  maintenanceStatus: translateDashboard(language, "health.awaitingData"),
  generationStatus: translateDashboard(language, "health.noLiveData"),
  batteryStatus: translateDashboard(language, "health.unknownBattery"),
  recommendedAction: translateDashboard(language, "health.restoreDataFlow"),
});

const emptyTwin: DigitalTwinState = {
  rotorStatus: "offline",
  generatorStatus: "offline",
  towerStatus: "offline",
  electricalStatus: "offline",
  batteryStatus: "offline",
  sensorsStatus: "offline",
  connectivityStatus: "offline",
  windDirectionDeg: null,
  windDirectionStatus: "offline",
  temperatureStatus: "offline",
  vibrationStatus: "offline",
  voltageStatus: "offline",
  powerFlowLevel: 0,
  animationLevel: 0,
  highlights: [],
  warnings: [],
};

const buildEmptySnapshot = (language: DashboardLanguage): DashboardSnapshot => ({
  latest: null,
  history: [],
  alarms: [],
  maintenance: [],
  ai: null,
  health: buildEmptyHealth(language),
  twin: emptyTwin,
  lastUpdatedAt: null,
});

const DashboardDataContext = createContext<DashboardContextShape | null>(null);

const readThemePreference = (): ThemeMode => {
  if (typeof window === "undefined") return ENV.defaultTheme === "light" ? "light" : "dark";
  const stored = window.localStorage.getItem("aurora-noctua-theme");
  if (stored === "light" || stored === "dark") return stored;
  return ENV.defaultTheme === "light" ? "light" : "dark";
};

const applyTheme = (mode: ThemeMode) => {
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
};

const readLanguagePreference = (): DashboardLanguage => {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem("aurora-noctua-language");
  if (stored === "es" || stored === "en" || stored === "qu" || stored === "zh") return stored;
  const browserLanguage = window.navigator.language.toLowerCase();
  if (browserLanguage.startsWith("es")) return "es";
  if (browserLanguage.startsWith("qu")) return "qu";
  if (browserLanguage.startsWith("zh")) return "zh";
  return "en";
};

const mergeAlarm = (prev: AlarmItem[], incoming: AlarmItem) =>
  [incoming, ...prev.filter((item) => item.id !== incoming.id)].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

export const DashboardDataProvider = ({ children }: { children: React.ReactNode }) => {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(() => buildEmptySnapshot(readLanguagePreference()));
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [themeMode, setThemeMode] = useState<ThemeMode>(readThemePreference);
  const [language, setLanguage] = useState<DashboardLanguage>(readLanguagePreference);

  const composeSnapshot = useCallback(
    (
      latest: TelemetryPoint | null,
      history: TelemetryPoint[],
      alarms: AlarmItem[],
      ai: DashboardSnapshot["ai"],
      hasError: boolean,
    ) => {
      const connectivity = deviceStatusService.resolveConnectivity(latest, ENV.staleAfterMs, hasError);
      const localizedRemoteAlarms = alarms
        .filter((alarm) => !alertsService.isDerived(alarm))
        .map((alarm) => relocalizeAlarm(alarm, language));
      const effectiveAlarms = alertsService.enrichOperational(latest, localizedRemoteAlarms, language);
      const maintenance = maintenanceService.derive(latest, history, effectiveAlarms, ai, language);
      const health = deviceStatusService.computeHealth(latest, effectiveAlarms, connectivity, language);
      const twin = digitalTwinService.build(latest, connectivity, language);

      return {
        latest,
        history,
        alarms: effectiveAlarms,
        maintenance,
        ai,
        health,
        twin,
        lastUpdatedAt: latest?.timestamp ?? (history.length ? history[history.length - 1].timestamp : null),
      } satisfies DashboardSnapshot;
    },
    [language],
  );

  const load = useCallback(
    async (intent: "initial" | "refresh" | "poll") => {
      if (intent === "initial") setIsLoading(true);
      if (intent === "refresh") setIsRefreshing(true);

      try {
        const latest = await telemetryService.getLatest();
        const [history, alarms, ai] = await Promise.all([
          telemetryService.getHistory(timeRange, latest),
          alertsService.list(ENV.deviceId, language),
          aiOperationalService.getSnapshot(latest, { force: intent !== "poll" }),
        ]);

        setSnapshot(composeSnapshot(latest, history, alarms, ai, false));
        setErrorMessage(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : translateDashboard(language, "common.unknown");
        setErrorMessage(message);
        setSnapshot((current) => composeSnapshot(current.latest, current.history, current.alarms, current.ai, true));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [composeSnapshot, language, timeRange],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  useEffect(() => {
    if (snapshot.latest || snapshot.history.length) {
      void load("poll");
    }
  }, [timeRange]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load("poll");
    }, ENV.pollMs);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const subscription = realtimeService.connect({
      onConnection: setIsRealtimeConnected,
      onReading: (reading) => {
        setSnapshot((current) => {
          const history = [...current.history, reading]
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .slice(-96);

          return composeSnapshot(reading, history, current.alarms, current.ai, false);
        });
      },
      onAlarm: (alarm) => {
        setSnapshot((current) => composeSnapshot(current.latest, current.history, mergeAlarm(current.alarms, alarm), current.ai, false));
      },
    }, language);

    return () => {
      subscription.disconnect();
    };
  }, [composeSnapshot, language]);

  useEffect(() => {
    applyTheme(themeMode);
    window.localStorage.setItem("aurora-noctua-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : language;
    window.localStorage.setItem("aurora-noctua-language", language);
    setSnapshot((current) => composeSnapshot(current.latest, current.history, current.alarms, current.ai, Boolean(errorMessage)));
  }, [composeSnapshot, errorMessage, language]);

  const refresh = useCallback(async () => {
    await load("refresh");
  }, [load]);

  const acknowledgeAlarm = useCallback(async (alarmId: string) => {
    try {
      const updated = await alertsService.acknowledge(alarmId, language);
      if (!updated) return;
      setSnapshot((current) => composeSnapshot(current.latest, current.history, mergeAlarm(current.alarms, updated), current.ai, false));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : translateDashboard(language, "common.unknown"));
    }
  }, [composeSnapshot, language]);

  const toggleTheme = useCallback(() => {
    setThemeMode((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage((current) => {
      const sequence: DashboardLanguage[] = ["es", "en", "qu", "zh"];
      const index = sequence.indexOf(current);
      return sequence[(index + 1) % sequence.length];
    });
  }, []);

  const value = useMemo<DashboardContextShape>(
    () => ({
      snapshot,
      timeRange,
      setTimeRange,
      refresh,
      acknowledgeAlarm,
      isLoading,
      isRefreshing,
      isRealtimeConnected,
      errorMessage,
      themeMode,
      toggleTheme,
      language,
      toggleLanguage,
    }),
    [
      acknowledgeAlarm,
      errorMessage,
      isLoading,
      isRealtimeConnected,
      isRefreshing,
      language,
      refresh,
      snapshot,
      themeMode,
      timeRange,
      toggleLanguage,
      toggleTheme,
    ],
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
};

export const useDashboardData = () => {
  const value = useContext(DashboardDataContext);
  if (!value) {
    throw new Error("useDashboardData must be used within DashboardDataProvider");
  }
  return value;
};

import { AppLanguage, translate } from "../i18n/translations";
import { AlertItem, SyncState, SystemLevel, TelemetryReading } from "../types/aerogen";
import { isReadingStale, temperatureState, vibrationState, windState } from "../utils/format";

type SyncInput = {
  apiConfigured: boolean;
  useMockData: boolean;
  hasLoadedOnce: boolean;
  hasData: boolean;
  reading: TelemetryReading | null;
  lastFetchFailed: boolean;
  staleAfterMs: number;
};

const hasCriticalAlert = (alerts: AlertItem[]) => alerts.some((alert) => alert.status === "open" && alert.severity === "stop");
const hasWarningAlert = (alerts: AlertItem[]) => alerts.some((alert) => alert.status === "open" && alert.severity === "warn");
const hasOpenAlert = (alerts: AlertItem[], type: string) => alerts.some((alert) => alert.status === "open" && alert.type === type);

const alertCopy: Record<string, { titleKey: string; actionKey: string; messageKey: string }> = {
  battery_low: {
    titleKey: "alerts.type.battery_low",
    actionKey: "alerts.action.battery_low",
    messageKey: "alerts.message.battery_low",
  },
  battery_critical: {
    titleKey: "alerts.type.battery_critical",
    actionKey: "alerts.action.battery_critical",
    messageKey: "alerts.message.battery_critical",
  },
  battery_overtemperature: {
    titleKey: "alerts.type.battery_overtemperature",
    actionKey: "alerts.action.battery_overtemperature",
    messageKey: "alerts.message.battery_overtemperature",
  },
  system_overload: {
    titleKey: "alerts.type.system_overload",
    actionKey: "alerts.action.system_overload",
    messageKey: "alerts.message.system_overload",
  },
  supply_cut: {
    titleKey: "alerts.type.supply_cut",
    actionKey: "alerts.action.supply_cut",
    messageKey: "alerts.message.supply_cut",
  },
  inverter_fault: {
    titleKey: "alerts.type.inverter_fault",
    actionKey: "alerts.action.inverter_fault",
    messageKey: "alerts.message.inverter_fault",
  },
  low_wind: {
    titleKey: "alerts.type.low_wind",
    actionKey: "alerts.action.low_wind",
    messageKey: "alerts.message.low_wind",
  },
  high_wind: {
    titleKey: "alerts.type.high_wind",
    actionKey: "alerts.action.high_wind",
    messageKey: "alerts.message.high_wind",
  },
  rotor_rpm_high: {
    titleKey: "alerts.type.rotor_rpm_high",
    actionKey: "alerts.action.rotor_rpm_high",
    messageKey: "alerts.message.rotor_rpm_high",
  },
  vibration_high: {
    titleKey: "alerts.type.vibration_high",
    actionKey: "alerts.action.vibration_high",
    messageKey: "alerts.message.vibration_high",
  },
  inverter_temp_high: {
    titleKey: "alerts.type.inverter_temp_high",
    actionKey: "alerts.action.inverter_temp_high",
    messageKey: "alerts.message.inverter_temp_high",
  },
};

export const deviceStatusService = {
  resolveSyncState(input: SyncInput): SyncState {
    if (input.useMockData) return "live";
    if (!input.apiConfigured) return "offline";
    if (input.lastFetchFailed && !input.hasData) return "error";
    if (!input.hasLoadedOnce) return "live";
    if (!input.hasData) return "empty";
    if (input.lastFetchFailed) return "offline";
    if (isReadingStale(input.reading, input.staleAfterMs)) return "stale";
    return "live";
  },

  getSyncCopy(syncState: SyncState, language: AppLanguage) {
    const keyByState: Record<SyncState, { level: SystemLevel; label: string; message: string }> = {
      live: {
        level: "ok",
        label: translate(language, "common.sync.live"),
        message: translate(language, "common.sync.liveMessage"),
      },
      stale: {
        level: "warn",
        label: translate(language, "common.sync.stale"),
        message: translate(language, "common.sync.staleMessage"),
      },
      offline: {
        level: "warn",
        label: translate(language, "common.sync.offline"),
        message: translate(language, "common.sync.offlineMessage"),
      },
      empty: {
        level: "warn",
        label: translate(language, "common.sync.empty"),
        message: translate(language, "common.sync.emptyMessage"),
      },
      error: {
        level: "stop",
        label: translate(language, "common.sync.error"),
        message: translate(language, "common.sync.errorMessage"),
      },
    };

    return keyByState[syncState];
  },

  getSystemSummary(reading: TelemetryReading | null, alerts: AlertItem[], language: AppLanguage) {
    if (!reading) {
      return {
        level: "warn" as SystemLevel,
        title: translate(language, "format.system.noData.title"),
        message: translate(language, "format.system.noData.message"),
      };
    }

    if (
      hasCriticalAlert(alerts) ||
      (reading.batteryPct ?? 100) <= 10 ||
      (reading.genTempC ?? 0) > 70 ||
      (reading.rotorRpm ?? 0) >= 750
    ) {
      return {
        level: "stop" as SystemLevel,
        title: translate(language, "format.system.stop.title"),
        message: translate(language, "format.system.stop.message"),
      };
    }

    if (
      hasWarningAlert(alerts) ||
      (reading.vibrationRms ?? 0) >= 7 ||
      (reading.batteryPct ?? 100) < 20 ||
      (reading.windSpeedMs ?? 0) > 20
    ) {
      return {
        level: "warn" as SystemLevel,
        title: translate(language, "format.system.warn.title"),
        message: translate(language, "format.system.warn.message"),
      };
    }

    if ((reading.windSpeedMs ?? 0) < 3) {
      return {
        level: "warn" as SystemLevel,
        title: translate(language, "format.system.lowWind.title"),
        message: translate(language, "format.system.lowWind.message"),
      };
    }

    return {
      level: "ok" as SystemLevel,
      title: translate(language, "format.system.ok.title"),
      message: translate(language, "format.system.ok.message"),
    };
  },

  getPrimarySituation(reading: TelemetryReading | null, alerts: AlertItem[], language: AppLanguage) {
    const openAlerts = alerts.filter((alert) => alert.status === "open");
    const wind = windState(reading?.windSpeedMs, language);
    const vibration = vibrationState(reading?.vibrationRms, language);

    if (!reading) {
      return {
        eyebrow: translate(language, "home.story.waitingEyebrow"),
        title: translate(language, "home.story.waitingTitle"),
        message: translate(language, "home.story.waitingMessage"),
      };
    }

    if (hasOpenAlert(openAlerts, "supply_cut")) {
      return {
        eyebrow: translate(language, "home.story.attentionEyebrow"),
        title: translate(language, "home.story.supplyCutTitle"),
        message: translate(language, "home.story.supplyCutMessage"),
      };
    }

    if (hasOpenAlert(openAlerts, "inverter_fault")) {
      return {
        eyebrow: translate(language, "home.story.attentionEyebrow"),
        title: translate(language, "home.story.inverterFaultTitle"),
        message: translate(language, "home.story.inverterFaultMessage"),
      };
    }

    if (hasOpenAlert(openAlerts, "battery_critical") || (reading.batteryPct ?? 100) <= 10) {
      return {
        eyebrow: translate(language, "home.story.attentionEyebrow"),
        title: translate(language, "home.story.batteryCriticalTitle"),
        message: translate(language, "home.story.batteryCriticalMessage"),
      };
    }

    if (hasOpenAlert(openAlerts, "system_overload")) {
      return {
        eyebrow: translate(language, "home.story.attentionEyebrow"),
        title: translate(language, "home.story.overloadTitle"),
        message: translate(language, "home.story.overloadMessage"),
      };
    }

    if (hasOpenAlert(openAlerts, "battery_low") || (reading.batteryPct ?? 100) < 20) {
      return {
        eyebrow: translate(language, "home.story.attentionEyebrow"),
        title: translate(language, "home.story.batteryLowTitle"),
        message: translate(language, "home.story.batteryLowMessage"),
      };
    }

    if (hasOpenAlert(openAlerts, "battery_overtemperature")) {
      return {
        eyebrow: translate(language, "home.story.attentionEyebrow"),
        title: translate(language, "home.story.batteryTempTitle"),
        message: translate(language, "home.story.batteryTempMessage"),
      };
    }

    if (hasOpenAlert(openAlerts, "inverter_temp_high") || (reading.genTempC ?? 0) > 70) {
      return {
        eyebrow: translate(language, "home.story.attentionEyebrow"),
        title: translate(language, "home.story.tempTitle"),
        message: translate(language, "home.story.tempMessage"),
      };
    }

    if (hasOpenAlert(openAlerts, "rotor_rpm_high") || (reading.rotorRpm ?? 0) >= 750) {
      return {
        eyebrow: translate(language, "home.story.attentionEyebrow"),
        title: translate(language, "home.story.rpmTitle"),
        message: translate(language, "home.story.rpmMessage"),
      };
    }

    if (hasOpenAlert(openAlerts, "vibration_high") || (reading.vibrationRms ?? 0) >= 7) {
      return {
        eyebrow: translate(language, "home.story.attentionEyebrow"),
        title: translate(language, "home.story.vibrationTitle"),
        message: vibration.label,
      };
    }

    if (hasOpenAlert(openAlerts, "high_wind") || (reading.windSpeedMs ?? 0) > 20) {
      return {
        eyebrow: translate(language, "home.story.attentionEyebrow"),
        title: translate(language, "home.story.highWindTitle"),
        message: wind.message,
      };
    }

    if (hasOpenAlert(openAlerts, "low_wind") || (reading.windSpeedMs ?? 0) < 3) {
      return {
        eyebrow: translate(language, "home.story.attentionEyebrow"),
        title: translate(language, "home.story.lowWindTitle"),
        message: translate(language, "home.story.lowWindMessage"),
      };
    }

    return {
      eyebrow: translate(language, "home.story.todayEyebrow"),
      title: translate(language, "home.story.normalTitle"),
      message:
        reading.estimatedAutonomyHours !== null && reading.estimatedAutonomyHours !== undefined
          ? translate(language, "home.story.normalAutonomyMessage", {
              hours: reading.estimatedAutonomyHours.toFixed(1),
            })
          : translate(language, "home.story.normalMessage"),
    };
  },

  getAlertPresentation(alert: AlertItem, language: AppLanguage) {
    const entry = alertCopy[alert.type];
    return {
      title: entry ? translate(language, entry.titleKey) : translate(language, "common.systemEvent"),
      action: entry ? translate(language, entry.actionKey) : translate(language, "alerts.action.default"),
      message: entry ? translate(language, entry.messageKey) : "",
      severity: alert.severity,
    };
  },
};

import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { HeroBanner } from "../components/HeroBanner";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import { ScreenLayout } from "../components/ScreenLayout";
import { StatusTag } from "../components/StatusTag";
import { ENV } from "../config/env";
import { useI18n } from "../i18n/LanguageContext";
import { deviceStatusService } from "../services/deviceStatusService";
import { useAero } from "../state/AeroContext";
import { fonts, palette, radius, spacing } from "../theme";
import {
  acVoltageState,
  estimateAutonomyHours,
  round,
  temperatureState,
  vibrationState,
  voltageState,
  windDirectionLabel,
  windState,
} from "../utils/format";

export const HomeScreen = () => {
  const { reading, pendingAlerts, loading, refreshing, syncState, refresh } = useAero();
  const { language, t } = useI18n();

  const system = deviceStatusService.getSystemSummary(reading, pendingAlerts, language);
  const situation = deviceStatusService.getPrimarySituation(reading, pendingAlerts, language);
  const sync = deviceStatusService.getSyncCopy(syncState, language);
  const primaryMessage =
    syncState === "live" || syncState === "empty"
      ? situation.message
      : `${situation.message} ${sync.message}`;
  const wind = windState(reading?.windSpeedMs, language);
  const temp = temperatureState(reading?.genTempC, language);
  const vibration = vibrationState(reading?.vibrationRms, language);
  const batteryVoltage = voltageState(reading?.genVoltageV, language);
  const acVoltage = acVoltageState(reading?.outputVoltageAcV, language);
  const autonomyHours = reading?.estimatedAutonomyHours ?? estimateAutonomyHours(reading?.batteryPct, reading?.loadPowerW, ENV.batteryCapacityKwh);
  const batteryTone =
    (reading?.batteryPct ?? 100) < 20 ? "danger" : (reading?.batteryPct ?? 100) < 40 ? "warn" : "good";
  const windTone =
    (reading?.windSpeedMs ?? 0) > 20 ? "danger" : (reading?.windSpeedMs ?? 0) < 3 ? "warn" : "sky";
  const contextAcLabel = acVoltage.level === "ok" ? t("home.section.context.acStable") : acVoltage.label;
  const supplyMessage = t("home.section.context.message", {
    direction: windDirectionLabel(reading?.windDirectionDeg, language),
    voltage: round(reading?.outputVoltageAcV, 0),
    current: round(reading?.outputCurrentAcA, 1),
  });

  return (
    <ScreenLayout refreshing={loading || refreshing} onRefresh={() => void refresh()}>
      <HeroBanner icon="fan" title={t("home.hero.title")} colors={["#0B6E99", "#16A6DB"]} />

      <Panel
        title={situation.title}
        centerHeaderText
        rightSlot={<MaterialCommunityIcons name="shield-check-outline" size={22} color={palette.sky700} />}
      >
        <Text style={styles.bodyText}>{primaryMessage}</Text>
      </Panel>

      <Panel
        title={t("home.activeAlerts.title")}
        subtitle={
          pendingAlerts.length
            ? t("home.activeAlerts.subtitleCount", { count: pendingAlerts.length })
            : t("home.activeAlerts.subtitleNone")
        }
        centerHeaderText
        rightSlot={
          <MaterialCommunityIcons
            name="bell-alert-outline"
            size={22}
            color={pendingAlerts.length ? palette.warn : palette.good}
          />
        }
      >
        {!pendingAlerts.length ? (
          <Text style={styles.bodyText}>{t("home.activeAlerts.noneText")}</Text>
        ) : (
          <View style={styles.alertList}>
            {pendingAlerts.map((alert) => (
              <View key={alert.id} style={styles.alertRow}>
                <View
                  style={[
                    styles.alertDot,
                    { backgroundColor: alert.severity === "stop" ? palette.danger : palette.warn },
                  ]}
                />
                <Text style={styles.alertRowText}>
                  {deviceStatusService.getAlertPresentation(alert, language).title}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Panel>

      <View style={styles.metricGrid}>
        <MetricCard
          icon="flash-outline"
          title={t("home.energy.title")}
          value={round(reading?.energyTodayKwh, 2)}
          unit="kWh"
          helper={t("home.energy.info")}
          tone="sky"
        />
        <MetricCard
          icon="battery-high"
          title={t("home.battery.title")}
          value={round(reading?.batteryPct, 0)}
          unit="%"
          helper={t("home.battery.autonomy", {
            hours: autonomyHours === null ? "--" : `${round(autonomyHours, 1)} h`,
          })}
          tone={batteryTone}
        />
      </View>

      <View style={styles.metricGrid}>
        <MetricCard
          icon="bell-alert-outline"
          title={t("home.activeAlerts.title")}
          value={String(pendingAlerts.length)}
          helper={
            pendingAlerts.length ? t("home.activeAlerts.subtitleCount", { count: pendingAlerts.length }) : t("home.activeAlerts.subtitleNone")
          }
          tone={pendingAlerts.length ? "warn" : "good"}
        />
        <MetricCard
          icon="home-lightning-bolt-outline"
          title={t("home.consumption.title")}
          value={round(reading?.loadPowerW, 0)}
          unit="W"
          helper={t("home.consumption.subtitle")}
          tone="neutral"
        />
      </View>

      <Panel
        title={t("home.section.context.title")}
        centerHeaderText
        rightSlot={<MaterialCommunityIcons name="home-lightning-bolt-outline" size={22} color={palette.sky700} />}
      >
        <View style={styles.contextStack}>
          <StatusTag level={acVoltage.level} text={t("home.section.context.status", { wind: wind.label, ac: contextAcLabel })} />
          <Text style={styles.bodyText}>{supplyMessage}</Text>
        </View>
        <View style={styles.metricGrid}>
          <MetricCard
            icon="weather-windy"
            title={t("home.wind.title")}
            value={round(reading?.windSpeedMs, 1)}
            unit="m/s"
            helper={wind.message}
            tone={windTone}
          />
          <MetricCard
            icon="sine-wave"
            title={t("home.acVoltage.title")}
            value={round(reading?.outputVoltageAcV, 1)}
            unit="V"
            helper={acVoltage.label}
            tone={acVoltage.level === "ok" ? "good" : acVoltage.level === "warn" ? "warn" : "danger"}
          />
        </View>
      </Panel>

      <Panel
        title={t("home.section.health.title")}
        subtitle={t("home.section.health.subtitle")}
        centerHeaderText
        rightSlot={<MaterialCommunityIcons name="heart-pulse" size={22} color={palette.sky700} />}
      >
        <View style={styles.metricGrid}>
          <MetricCard
            icon="thermometer"
            title={t("home.temperature.title")}
            value={round(reading?.genTempC, 1)}
            unit="C"
            helper={temp.label}
            tone={temp.level === "ok" ? "good" : temp.level === "warn" ? "warn" : "danger"}
          />
          <MetricCard
            icon="vibrate"
            title={t("home.vibration.title")}
            value={round(reading?.vibrationRms, 2)}
            unit="m/s2"
            helper={vibration.label}
            tone={vibration.level === "ok" ? "good" : vibration.level === "warn" ? "warn" : "danger"}
          />
        </View>
        <View style={styles.metricGrid}>
          <MetricCard
            icon="battery"
            title={t("home.dcVoltage.title")}
            value={round(reading?.genVoltageV, 1)}
            unit="V"
            helper={batteryVoltage.label}
            tone={batteryVoltage.level === "ok" ? "good" : batteryVoltage.level === "warn" ? "warn" : "danger"}
          />
          <MetricCard
            icon="compass-rose"
            title={t("home.windDirection.title")}
            value={windDirectionLabel(reading?.windDirectionDeg, language)}
            helper={t("home.windDirection.subtitle")}
            tone="neutral"
          />
        </View>
      </Panel>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  bodyText: {
    color: palette.textSoft,
    fontFamily: fonts.body,
    lineHeight: 20,
    textAlign: "center",
  },
  contextStack: {
    width: "100%",
    alignItems: "center",
    gap: spacing.md,
  },
  alertList: {
    width: "100%",
    gap: spacing.sm,
  },
  alertRow: {
    width: "100%",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  alertDot: {
    width: 9,
    height: 9,
    borderRadius: 99,
  },
  alertRowText: {
    flex: 1,
    color: palette.text,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    lineHeight: 18,
  },
  metricGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
});

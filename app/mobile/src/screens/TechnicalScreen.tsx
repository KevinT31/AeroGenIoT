import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HeroBanner } from "../components/HeroBanner";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import { ScreenLayout } from "../components/ScreenLayout";
import { StatusTag } from "../components/StatusTag";
import { ENV } from "../config/env";
import { useI18n } from "../i18n/LanguageContext";
import { AppLanguage } from "../i18n/translations";
import { useAero } from "../state/AeroContext";
import { fonts, palette, radius, spacing } from "../theme";
import {
  acVoltageState,
  estimateAutonomyHours,
  round,
  rpmState,
  temperatureState,
  vibrationState,
  voltageState,
  windDirectionLabel,
  windState,
} from "../utils/format";

export const TechnicalScreen = () => {
  const { reading, syncState, isConnectedRealtime, isRealtimeEnabled } = useAero();
  const { language, setLanguage, t } = useI18n();
  const wind = windState(reading?.windSpeedMs, language);
  const temp = temperatureState(reading?.genTempC, language);
  const vibration = vibrationState(reading?.vibrationRms, language);
  const batteryVoltage = voltageState(reading?.genVoltageV, language);
  const acVoltage = acVoltageState(reading?.outputVoltageAcV, language);
  const rotorRpm = rpmState(reading?.rotorRpm, language);
  const autonomyHours =
    reading?.estimatedAutonomyHours ?? estimateAutonomyHours(reading?.batteryPct, reading?.loadPowerW, ENV.batteryCapacityKwh);
  const hasVibrationSignal = reading?.vibrationSignal !== null && reading?.vibrationSignal !== undefined;
  const windLevel = (reading?.windSpeedMs ?? 0) > 20 ? "stop" : (reading?.windSpeedMs ?? 0) < 3 ? "warn" : "ok";
  const languageOptions: Array<{ code: AppLanguage; key: string }> = [
    { code: "es", key: "language.es" },
    { code: "en", key: "language.en" },
    { code: "qu", key: "language.qu" },
    { code: "zh", key: "language.zh" },
  ];

  return (
    <ScreenLayout>
      <HeroBanner icon="compass-rose" title={t("technical.hero.title")} colors={["#0C5E8D", "#1998D0"]} />

      <Panel
        title={t("technical.system.title")}
        centerHeaderText
        rightSlot={<MaterialCommunityIcons name="shield-check-outline" size={22} color={palette.sky700} />}
      >
        <View style={styles.statusStack}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>{t("technical.sync.titleShort")}</Text>
            <Text style={styles.statusValue}>
              {t(
                {
                  live: "common.sync.liveShort",
                  stale: "common.sync.staleShort",
                  offline: "common.sync.offlineShort",
                  empty: "common.sync.emptyShort",
                  error: "common.sync.errorShort",
                }[syncState],
              )}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>{t("technical.sync.channelShort")}</Text>
            <Text style={styles.statusValue}>
              {isRealtimeEnabled
                ? isConnectedRealtime
                  ? t("technical.sync.realtimeShort")
                  : t("technical.sync.pollingShort")
                : t("technical.sync.restOnlyShort")}
            </Text>
          </View>
        </View>
      </Panel>

      <Panel
        title={t("technical.metrics.title")}
        centerHeaderText
        rightSlot={<MaterialCommunityIcons name="chart-box-outline" size={22} color={palette.sky700} />}
      >
        <View style={styles.metricGrid}>
          <MetricCard
            icon="weather-windy"
            title={t("technical.sensor.wind")}
            value={round(reading?.windSpeedMs, 1)}
            unit="m/s"
            helper={wind.label}
            tone="sky"
          />
          <MetricCard
            icon="compass-rose"
            title={t("technical.sensor.direction")}
            value={windDirectionLabel(reading?.windDirectionDeg, language)}
            helper={t("technical.sensor.directionHelper")}
            tone="neutral"
          />
        </View>
        <View style={styles.metricGrid}>
          <MetricCard
            icon="rotate-3d-variant"
            title={t("technical.sensor.rpm")}
            value={round(reading?.rotorRpm, 0)}
            unit="rpm"
            helper={rotorRpm.label}
            tone={rotorRpm.level === "ok" ? "good" : rotorRpm.level === "warn" ? "warn" : "danger"}
          />
          <MetricCard
            icon="vibrate"
            title={t("technical.sensor.vibration")}
            value={round(reading?.vibrationRms, 2)}
            unit="m/s2"
            helper={vibration.label}
            tone={vibration.level === "ok" ? "good" : vibration.level === "warn" ? "warn" : "danger"}
          />
        </View>
        <View style={styles.metricGrid}>
          <MetricCard
            icon="battery"
            title={t("technical.sensor.voltage")}
            value={round(reading?.genVoltageV, 1)}
            unit="V"
            helper={batteryVoltage.label}
            tone={batteryVoltage.level === "ok" ? "good" : batteryVoltage.level === "warn" ? "warn" : "danger"}
          />
          <MetricCard
            icon="current-dc"
            title={t("technical.sensor.current")}
            value={round(reading?.genCurrentA, 1)}
            unit="A"
            helper={t("technical.sensor.currentHelper")}
            tone="neutral"
          />
        </View>
        <View style={styles.metricGrid}>
          <MetricCard
            icon="flash-outline"
            title={t("technical.sensor.power")}
            value={round(reading?.powerW, 0)}
            unit="W"
            helper={t("technical.sensor.powerHelper")}
            tone="good"
          />
          <MetricCard
            icon="battery-high"
            title={t("technical.sensor.battery")}
            value={round(reading?.batteryPct, 0)}
            unit="%"
            helper={t("technical.sensor.batteryHelper", {
              hours: autonomyHours === null ? "--" : `${round(autonomyHours, 1)} h`,
            })}
            tone={(reading?.batteryPct ?? 100) < 20 ? "warn" : "good"}
          />
        </View>
        <View style={styles.metricGrid}>
          <MetricCard
            icon="sine-wave"
            title={t("technical.sensor.acVoltage")}
            value={round(reading?.outputVoltageAcV, 1)}
            unit="V"
            helper={acVoltage.label}
            tone={acVoltage.level === "ok" ? "good" : acVoltage.level === "warn" ? "warn" : "danger"}
          />
          <MetricCard
            icon="current-ac"
            title={t("technical.sensor.acCurrent")}
            value={round(reading?.outputCurrentAcA, 1)}
            unit="A"
            helper={t("technical.sensor.acCurrentHelper")}
            tone="neutral"
          />
        </View>
        <View style={styles.metricGrid}>
          <MetricCard
            icon="home-lightning-bolt-outline"
            title={t("technical.sensor.load")}
            value={round(reading?.loadPowerW, 0)}
            unit="W"
            helper={t("technical.sensor.loadHelper")}
            tone="sky"
          />
          <MetricCard
            icon="thermometer"
            title={t("technical.sensor.temp")}
            value={round(reading?.genTempC, 1)}
            unit="C"
            helper={temp.label}
            tone={temp.level === "ok" ? "good" : temp.level === "warn" ? "warn" : "danger"}
          />
        </View>
        <View style={styles.metricGrid}>
          <MetricCard
            icon="flash-outline"
            title={t("technical.sensor.energy")}
            value={round(reading?.energyTodayKwh, 2)}
            unit="kWh"
            helper={t("technical.sensor.energyHelper")}
            tone="sky"
          />
          {hasVibrationSignal ? (
            <MetricCard
              icon="vibrate"
              title={t("technical.sensor.vibrationSignal")}
              value={round(reading?.vibrationSignal, 3)}
              helper={t("technical.sensor.vibrationSignalHelper")}
              tone="neutral"
            />
          ) : null}
        </View>
      </Panel>

      <Panel
        title={t("technical.source.title")}
        centerHeaderText
        rightSlot={<MaterialCommunityIcons name="transmission-tower" size={22} color={palette.sky700} />}
      >
        <Text style={styles.sourceText}>
          {t("technical.context.message", {
            direction: windDirectionLabel(reading?.windDirectionDeg, language),
            voltage: round(reading?.outputVoltageAcV, 0),
            current: round(reading?.outputCurrentAcA, 1),
            autonomy: autonomyHours === null ? "--" : round(autonomyHours, 1),
          })}
        </Text>
        <View style={styles.tagStack}>
          <StatusTag level={windLevel} text={t("technical.tag.wind", { value: wind.label })} />
        </View>
        <View style={styles.tagStack}>
          <StatusTag level={temp.level} text={t("technical.tag.temp", { value: temp.label })} />
        </View>
        <View style={styles.tagStack}>
          <StatusTag level={vibration.level} text={t("technical.tag.vibration", { value: vibration.label })} />
        </View>
        <View style={styles.tagStack}>
          <StatusTag level={rotorRpm.level} text={t("technical.tag.rpm", { value: rotorRpm.label })} />
        </View>
      </Panel>

      <Panel
        title={t("language.panel.title")}
        centerHeaderText
        rightSlot={<MaterialCommunityIcons name="translate" size={22} color={palette.sky700} />}
      >
        <View style={styles.languageRow}>
          {languageOptions.map((option) => {
            const isActive = language === option.code;
            return (
              <Pressable
                key={option.code}
                style={[styles.languageChip, isActive ? styles.languageChipActive : null]}
                onPress={() => setLanguage(option.code)}
              >
                <Text style={[styles.languageChipText, isActive ? styles.languageChipTextActive : null]}>
                  {t(option.key)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Panel>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  statusStack: {
    width: "100%",
    gap: spacing.md,
  },
  statusItem: {
    width: "100%",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    padding: spacing.sm,
    gap: 4,
    alignItems: "center",
  },
  statusLabel: {
    color: palette.textSoft,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    textAlign: "center",
  },
  statusValue: {
    color: palette.text,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  metricGrid: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sourceText: {
    color: palette.textSoft,
    fontFamily: fonts.body,
    lineHeight: 20,
    textAlign: "center",
  },
  tagStack: {
    marginTop: spacing.sm,
    width: "100%",
    alignItems: "center",
  },
  languageRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  languageChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  languageChipActive: {
    backgroundColor: palette.sky700,
    borderColor: palette.sky700,
  },
  languageChipText: {
    color: palette.text,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    textAlign: "center",
  },
  languageChipTextActive: {
    color: "#FFFFFF",
  },
});

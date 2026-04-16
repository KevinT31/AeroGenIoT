import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { HeroBanner } from "../components/HeroBanner";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import { ScreenLayout } from "../components/ScreenLayout";
import { useI18n } from "../i18n/LanguageContext";
import { useAero } from "../state/AeroContext";
import { fonts, palette, spacing } from "../theme";
import { energyEquivalences, round, rpmState, windState } from "../utils/format";

export const ProductionScreen = () => {
  const { reading } = useAero();
  const { language, t } = useI18n();
  const todayKwh = Number(reading?.energyTodayKwh || 0);
  const equivalent = energyEquivalences(todayKwh);
  const wind = windState(reading?.windSpeedMs, language);
  const rotorRpm = rpmState(reading?.rotorRpm, language);
  const windTone =
    (reading?.windSpeedMs ?? 0) > 20 ? "danger" : (reading?.windSpeedMs ?? 0) < 3 ? "warn" : "good";

  return (
    <ScreenLayout>
      <HeroBanner icon="chart-line" title={t("production.hero.title")} colors={["#0A6C86", "#13A7BF"]} />

      <Panel
        title={t("production.today.title")}
        subtitle={t("production.today.subtitle")}
        centerHeaderText
        rightSlot={<MaterialCommunityIcons name="flash-outline" size={22} color={palette.sky700} />}
      >
        <Text style={styles.energyValue}>{round(todayKwh, 2)} kWh</Text>
        <Text style={[styles.infoText, styles.infoTextHighlight]}>{t("production.today.phones", { phones: equivalent.phones })}</Text>
        <Text style={styles.infoText}>{t("production.today.lights", { hours: equivalent.fieldLightsHours })}</Text>
        <Text style={styles.infoText}>{t("production.today.pump", { hours: equivalent.pumpHours })}</Text>
      </Panel>

      <View style={styles.metricGrid}>
        <MetricCard
          icon="flash-outline"
          title={t("technical.sensor.power")}
          value={round(reading?.powerW, 0)}
          unit="W"
          helper={t("technical.sensor.powerHelper")}
          tone="sky"
        />
        <MetricCard
          icon="home-lightning-bolt-outline"
          title={t("technical.sensor.load")}
          value={round(reading?.loadPowerW, 0)}
          unit="W"
          helper={t("technical.sensor.loadHelper")}
          tone="neutral"
        />
      </View>

      <View style={styles.metricGrid}>
        <MetricCard
          icon="weather-windy"
          title={t("technical.sensor.wind")}
          value={round(reading?.windSpeedMs, 1)}
          unit="m/s"
          helper={wind.label}
          tone={windTone}
        />
        <MetricCard
          icon="rotate-3d-variant"
          title={t("technical.sensor.rpm")}
          value={round(reading?.rotorRpm, 0)}
          unit="rpm"
          helper={rotorRpm.label}
          tone={rotorRpm.level === "ok" ? "good" : rotorRpm.level === "warn" ? "warn" : "danger"}
        />
      </View>

      <View style={styles.metricGrid}>
        <MetricCard
          icon="sine-wave"
          title={t("technical.sensor.acVoltage")}
          value={round(reading?.outputVoltageAcV, 1)}
          unit="V"
          helper={t("technical.sensor.voltageHelper")}
          tone="good"
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
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  energyValue: {
    color: palette.text,
    fontSize: 36,
    fontFamily: fonts.title,
    textAlign: "center",
    width: "100%",
  },
  infoText: {
    marginTop: spacing.xs,
    color: palette.textSoft,
    fontFamily: fonts.body,
    lineHeight: 20,
    textAlign: "center",
    width: "100%",
  },
  infoTextHighlight: {
    color: palette.sky700,
    fontFamily: fonts.bodySemi,
  },
  metricGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
});

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
import { useAero } from "../state/AeroContext";
import { fonts, palette, radius, spacing } from "../theme";
import { AppLanguage } from "../i18n/translations";
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

const aiCopy = {
  es: {
    title: "IA operativa",
    fault: "Falla probable",
    power: "Pronostico",
    yaw: "Orientacion",
    noData: "Sin prediccion",
    confidence: "Confianza",
    horizon: "Horizonte",
    range: "Rango",
    action: "Accion",
    reason: "Motivo",
    align: "Alinear con la direccion viva del viento.",
    yawReason: "Recomendacion calculada para el dispositivo activo.",
  },
  en: {
    title: "Operational AI",
    fault: "Probable fault",
    power: "Forecast",
    yaw: "Yaw target",
    noData: "No prediction",
    confidence: "Confidence",
    horizon: "Horizon",
    range: "Range",
    action: "Action",
    reason: "Reason",
    align: "Align with the live wind direction.",
    yawReason: "Recommendation generated for the active device.",
  },
  qu: {
    title: "IA operativa",
    fault: "Probable falla",
    power: "Pronostico",
    yaw: "Orientacion",
    noData: "Mana prediccion kanchu",
    confidence: "Confianza",
    horizon: "Horizonte",
    range: "Rango",
    action: "Accion",
    reason: "Motivo",
    align: "Kunan wayra direccionwan alineay.",
    yawReason: "Activo dispositivopaq rekomendasqa.",
  },
} as const;

const faultLabels = {
  high_temp: { es: "Temperatura alta del inversor", en: "High inverter temperature", qu: "Temperatura hatun" },
  high_vibration: { es: "Vibracion alta del motor", en: "High motor vibration", qu: "Vibracion hatun" },
  low_battery: { es: "Reserva de bateria baja", en: "Low battery reserve", qu: "Bateria pisi" },
  overload: { es: "Riesgo de sobrecarga", en: "Overload risk", qu: "Sobrecarga peligru" },
  nominal_operation: { es: "Operacion nominal", en: "Nominal operation", qu: "Allin operacion" },
} as const;

const humanizeFaultLabel = (language: AppLanguage, label: string | null) => {
  if (!label) return aiCopy[language].noData;
  const known = faultLabels[label as keyof typeof faultLabels];
  if (known) return known[language];
  return label
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (token) => token.toUpperCase());
};

const formatNumber = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined || Number.isNaN(value) ? "--" : Number(value).toFixed(digits);

const formatPower = (value: number | null | undefined) =>
  value === null || value === undefined || Number.isNaN(value)
    ? "--"
    : `${Number(value).toFixed(value >= 1000 ? 0 : 1)} W`;

const aiLevel = (severity: "info" | "warning" | "critical" | null | undefined) => {
  if (severity === "critical") return "stop" as const;
  if (severity === "warning") return "warn" as const;
  return "ok" as const;
};

export const TechnicalScreen = () => {
  const { reading, aiOperational, syncState, isConnectedRealtime, isRealtimeEnabled } = useAero();
  const { language, setLanguage, t } = useI18n();
  const aiText = aiCopy[language];
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
        title={aiText.title}
        centerHeaderText
        rightSlot={<MaterialCommunityIcons name="brain" size={22} color={palette.sky700} />}
      >
        <View style={styles.aiStack}>
          <View style={styles.aiCard}>
            <View style={styles.aiHeaderRow}>
              <Text style={styles.aiLabel}>{aiText.fault}</Text>
              <StatusTag level={aiLevel(aiOperational?.faultPrediction?.severity)} text={humanizeFaultLabel(language, aiOperational?.faultPrediction?.label ?? null)} />
            </View>
            <Text style={styles.aiValue}>{humanizeFaultLabel(language, aiOperational?.faultPrediction?.label ?? null)}</Text>
            <Text style={styles.aiMeta}>
              {aiText.confidence}: {formatNumber(aiOperational?.faultPrediction?.confidencePct ?? null, 0)}%
            </Text>
          </View>

          <View style={styles.aiCard}>
            <Text style={styles.aiLabel}>{aiText.power}</Text>
            <Text style={styles.aiValue}>{formatPower(aiOperational?.powerForecast?.predictedPowerW ?? null)}</Text>
            <Text style={styles.aiMeta}>
              {aiText.horizon}: {formatNumber(aiOperational?.powerForecast?.horizonMinutes ?? null, 0)} min
            </Text>
            <Text style={styles.aiMeta}>
              {aiText.range}: {formatPower(aiOperational?.powerForecast?.lowerBoundW ?? null)} - {formatPower(aiOperational?.powerForecast?.upperBoundW ?? null)}
            </Text>
          </View>

          <View style={styles.aiCard}>
            <Text style={styles.aiLabel}>{aiText.yaw}</Text>
            <Text style={styles.aiValue}>
              {aiOperational?.yawRecommendation?.targetYawDeg === null || aiOperational?.yawRecommendation?.targetYawDeg === undefined
                ? aiText.noData
                : `${formatNumber(aiOperational?.yawRecommendation?.targetYawDeg ?? null, 0)}°`}
            </Text>
            <Text style={styles.aiMeta}>
              {aiText.action}: {aiOperational?.yawRecommendation?.action || aiText.align}
            </Text>
            <Text style={styles.aiMeta}>
              {aiText.reason}: {aiOperational?.yawRecommendation?.reason || aiText.yawReason}
            </Text>
          </View>
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
  aiStack: {
    width: "100%",
    gap: spacing.md,
  },
  aiCard: {
    width: "100%",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    padding: spacing.md,
    gap: 8,
  },
  aiHeaderRow: {
    width: "100%",
    gap: spacing.sm,
    alignItems: "center",
  },
  aiLabel: {
    color: palette.textSoft,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  aiValue: {
    color: palette.text,
    fontFamily: fonts.titleMedium,
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
  aiMeta: {
    color: palette.textSoft,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
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

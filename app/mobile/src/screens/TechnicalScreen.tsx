import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Panel } from "../components/Panel";
import { StatusTag } from "../components/StatusTag";
import { useAero } from "../state/AeroContext";
import { fonts, palette, radius, spacing } from "../theme";
import { round, sourceLabel, systemState, temperatureState, vibrationState, windState } from "../utils/format";

const Row = ({ label, value, unit }: { label: string; value: string; unit: string }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>
      {value} {unit}
    </Text>
  </View>
);

export const TechnicalScreen = () => {
  const { reading } = useAero();
  const system = systemState(reading);
  const wind = windState(reading?.windSpeedMs);
  const temp = temperatureState(reading?.genTempC);
  const vibration = vibrationState(reading?.vibrationRms);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <LinearGradient colors={["#0369A1", "#0EA5E9"]} style={styles.hero}>
        <Text style={styles.heroTitle}>Detalles tecnicos</Text>
        <Text style={styles.heroSub}>Panel para diagnostico del equipo.</Text>
      </LinearGradient>

      <Panel title="Estado general">
        <StatusTag level={system.level} text={system.title} />
        <Text style={styles.helpText}>{system.message}</Text>
      </Panel>

      <Panel title="Sensores IoT">
        <Row label="Velocidad del viento" value={round(reading?.windSpeedMs)} unit="m/s" />
        <Row label="Voltaje del generador" value={round(reading?.genVoltageV)} unit="V" />
        <Row label="Corriente del sistema" value={round(reading?.genCurrentA)} unit="A" />
        <Row label="Potencia calculada" value={round(reading?.powerW)} unit="W" />
        <Row label="Temperatura generador" value={round(reading?.genTempC)} unit="C" />
        <Row label="Vibracion RMS" value={round(reading?.vibrationRms)} unit="m/s2" />
        <Row label="Nivel de bateria" value={round(reading?.batteryPct, 0)} unit="%" />
      </Panel>

      <Panel title="Decision de fuente de energia" subtitle={sourceLabel(reading?.sourceNow)}>
        <Text style={styles.helpText}>{reading?.sourceReason || "Sin datos de decision por el momento."}</Text>
        <View style={styles.tagRow}>
          <StatusTag level={wind.label.includes("riesgo") ? "stop" : wind.label.includes("optima") ? "ok" : "warn"} text={`Viento: ${wind.label}`} />
        </View>
        <View style={styles.tagRow}>
          <StatusTag level={temp.level} text={`Temperatura: ${temp.label}`} />
        </View>
        <View style={styles.tagRow}>
          <StatusTag level={vibration.level} text={`Vibracion: ${vibration.label}`} />
        </View>
      </Panel>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#63CBF5",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.title,
    fontSize: 22,
  },
  heroSub: {
    marginTop: 4,
    color: "#DDF4FF",
    fontFamily: fonts.body,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    paddingVertical: 10,
  },
  rowLabel: {
    color: palette.textSoft,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    flex: 1,
  },
  rowValue: {
    color: palette.text,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    marginLeft: spacing.sm,
  },
  helpText: {
    marginTop: 8,
    color: palette.textSoft,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  tagRow: {
    marginTop: spacing.sm,
  },
});

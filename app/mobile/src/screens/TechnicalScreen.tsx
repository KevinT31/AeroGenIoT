import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Panel } from "../components/Panel";
import { StatusTag } from "../components/StatusTag";
import { useAero } from "../state/AeroContext";
import { fonts, palette, radius, spacing } from "../theme";
import { round, sourceLabel, systemState, temperatureState, vibrationState, windState } from "../utils/format";

const Row = ({ icon, label, value, unit }: { icon: string; label: string; value: string; unit: string }) => (
  <View style={styles.sensorTile}>
    <MaterialCommunityIcons name={icon as any} size={18} color={palette.sky700} />
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>
      {value} <Text style={styles.rowUnit}>{unit}</Text>
    </Text>
  </View>
);

export const TechnicalScreen = () => {
  const { reading } = useAero();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const system = systemState(reading);
  const wind = windState(reading?.windSpeedMs);
  const temp = temperatureState(reading?.genTempC);
  const vibration = vibrationState(reading?.vibrationRms);
  const contentPaddingBottom = spacing.xl + tabBarHeight + insets.bottom;

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: contentPaddingBottom }]}>
        <LinearGradient colors={["#0369A1", "#0EA5E9"]} style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <MaterialCommunityIcons name="tools" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>Detalles tecnicos</Text>
          <Text style={styles.heroSub}>Panel para diagnostico del equipo.</Text>
        </LinearGradient>

        <Panel
          title="Estado general"
          rightSlot={<MaterialCommunityIcons name="shield-check-outline" size={24} color={palette.sky700} />}
        >
          <StatusTag level={system.level} text={system.title} />
          <Text style={styles.helpText}>{system.message}</Text>
        </Panel>

        <Panel title="Sensores IoT" rightSlot={<MaterialCommunityIcons name="access-point-network" size={24} color={palette.sky700} />}>
          <View style={styles.sensorGrid}>
            <Row icon="weather-windy" label="Velocidad del viento" value={round(reading?.windSpeedMs)} unit="m/s" />
            <Row icon="sine-wave" label="Voltaje del generador" value={round(reading?.genVoltageV)} unit="V" />
            <Row icon="current-ac" label="Corriente del sistema" value={round(reading?.genCurrentA)} unit="A" />
            <Row icon="flash-outline" label="Potencia calculada" value={round(reading?.powerW)} unit="W" />
            <Row icon="thermometer" label="Temperatura generador" value={round(reading?.genTempC)} unit="C" />
            <Row icon="vibrate" label="Vibracion RMS" value={round(reading?.vibrationRms)} unit="m/s2" />
            <Row icon="battery-high" label="Nivel de bateria" value={round(reading?.batteryPct, 0)} unit="%" />
          </View>
        </Panel>

        <Panel
          title="Decision de fuente de energia"
          subtitle={sourceLabel(reading?.sourceNow)}
          rightSlot={<MaterialCommunityIcons name="transmission-tower" size={24} color={palette.sky700} />}
        >
          <Text style={styles.helpText}>{reading?.sourceReason || "Sin datos de decision por el momento."}</Text>
          <View style={styles.tagRow}>
            <StatusTag
              level={wind.label.includes("riesgo") ? "stop" : wind.label.includes("optima") ? "ok" : "warn"}
              text={`Viento: ${wind.label}`}
            />
          </View>
          <View style={styles.tagRow}>
            <StatusTag level={temp.level} text={`Temperatura: ${temp.label}`} />
          </View>
          <View style={styles.tagRow}>
            <StatusTag level={vibration.level} text={`Vibracion: ${vibration.label}`} />
          </View>
          <View style={styles.techHintRow}>
            <MaterialCommunityIcons name="information-outline" size={16} color={palette.textSoft} />
            <Text style={styles.techHintText}>Regla base: si powerW es menor que loadPowerW, entra apoyo de bateria.</Text>
          </View>
        </Panel>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#63CBF5",
    alignItems: "center",
    gap: 6,
    shadowColor: "#0B6A95",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.title,
    fontSize: 22,
    textAlign: "center",
  },
  heroSub: {
    color: "#DDF4FF",
    fontFamily: fonts.body,
    textAlign: "center",
  },
  sensorGrid: {
    width: "100%",
    gap: spacing.sm,
  },
  sensorTile: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#F7FBFF",
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
  },
  rowLabel: {
    color: palette.textSoft,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  rowValue: {
    color: palette.text,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    marginTop: 3,
    textAlign: "center",
  },
  rowUnit: {
    fontSize: 12,
    color: palette.textSoft,
    fontFamily: fonts.bodySemi,
  },
  helpText: {
    marginTop: 8,
    color: palette.textSoft,
    fontFamily: fonts.body,
    lineHeight: 20,
    textAlign: "center",
  },
  tagRow: {
    marginTop: spacing.sm,
    alignItems: "center",
    width: "100%",
  },
  techHintRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 6,
    width: "100%",
  },
  techHintText: {
    color: palette.textSoft,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: "92%",
  },
});

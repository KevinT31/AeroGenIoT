import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Panel } from "../components/Panel";
import { StatusTag } from "../components/StatusTag";
import { useAero } from "../state/AeroContext";
import { fonts, palette, radius, spacing } from "../theme";
import {
  energyEquivalences,
  estimateAutonomyHours,
  round,
  sourceLabel,
  systemState,
  temperatureState,
  timeAgo,
  vibrationState,
  voltageState,
  windState,
} from "../utils/format";
import { ENV } from "../config/env";

const levelColor = {
  ok: palette.good,
  warn: palette.warn,
  stop: palette.danger,
};

export const HomeScreen = () => {
  const { reading, loading, isConnectedRealtime, apiReachable, lastSyncAt, refresh } = useAero();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const status = systemState(reading);
  const wind = windState(reading?.windSpeedMs);
  const temp = temperatureState(reading?.genTempC);
  const vibration = vibrationState(reading?.vibrationRms);
  const voltage = voltageState(reading?.genVoltageV);
  const autonomyHours = estimateAutonomyHours(reading?.batteryPct, reading?.loadPowerW, ENV.batteryCapacityKwh);
  const equivalents = energyEquivalences(reading?.energyTodayKwh);
  const contentPaddingBottom = spacing.xl + tabBarHeight + insets.bottom;

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.page}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={palette.sky700} />}
        contentContainerStyle={[styles.content, { paddingBottom: contentPaddingBottom }]}
      >
        <LinearGradient colors={[palette.sky700, palette.sky500]} style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.heroTitle}>Aerogenerador - Parcela Norte</Text>
            <StatusTag
              level={isConnectedRealtime && apiReachable ? "ok" : "warn"}
              text={isConnectedRealtime && apiReachable ? "Conectado" : "Sin senal"}
            />
          </View>
          <Text style={styles.heroSub}>Ultima actualizacion: {timeAgo(lastSyncAt)}</Text>
        </LinearGradient>

        <Panel
          title={status.title}
          subtitle={status.message}
          rightSlot={<MaterialCommunityIcons name="shield-check" size={24} color={levelColor[status.level]} />}
        >
          <StatusTag
            level={status.level}
            text={
              status.level === "ok"
                ? "Generacion estable"
                : status.level === "warn"
                  ? "Requiere atencion"
                  : "Detenido por seguridad"
            }
          />
        </Panel>

        <Panel title="Estado del viento" subtitle="Anemometro">
          <Text style={styles.metricValue}>{round(reading?.windSpeedMs)} m/s</Text>
          <Text style={styles.metricLabel}>{wind.label}</Text>
          <Text style={styles.infoText}>{wind.message}</Text>
        </Panel>

        <Panel title="Energia generada hoy" subtitle="Produccion acumulada">
          <Text style={styles.metricValue}>{round(reading?.energyTodayKwh, 2)} kWh</Text>
          <Text style={styles.infoText}>Equivale a cargar {equivalents.phones} celulares.</Text>
          <Text style={styles.infoText}>Tambien alcanza para luces del campo por {equivalents.fieldLightsHours} horas.</Text>
        </Panel>

        <Panel title="Nivel de bateria" subtitle="Almacenamiento actual">
          <Text style={styles.metricValue}>{round(reading?.batteryPct, 0)}%</Text>
          <Text style={styles.infoText}>
            Autonomia aproximada: {autonomyHours === null ? "--" : `${round(autonomyHours, 1)} horas`}
          </Text>
        </Panel>

        <Panel title="Fuente actual de energia" subtitle={sourceLabel(reading?.sourceNow)}>
          <Text style={styles.infoText}>{reading?.sourceReason || "Esperando datos para determinar origen de energia."}</Text>
        </Panel>

        <View style={styles.row}>
          <View style={styles.col}>
            <Panel title="Estado electrico" subtitle="Basado en voltaje">
              <StatusTag level={voltage.level} text={voltage.label} />
            </Panel>
          </View>
          <View style={styles.col}>
            <Panel title="Consumo actual" subtitle="Demanda del sistema">
              <Text style={[styles.metricValue, { fontSize: 24 }]}>{round(reading?.loadPowerW, 0)} W</Text>
            </Panel>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Panel title="Temperatura" subtitle="Generador">
              <StatusTag level={temp.level} text={temp.label} />
            </Panel>
          </View>
          <View style={styles.col}>
            <Panel title="Vibracion" subtitle="Estado mecanico">
              <StatusTag level={vibration.level} text={vibration.label} />
            </Panel>
          </View>
        </View>
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
    borderColor: "#7FD8FF",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  heroTitle: {
    color: "#FFFFFF",
    flex: 1,
    fontSize: 22,
    fontFamily: fonts.title,
  },
  heroSub: {
    marginTop: spacing.sm,
    color: "#DDF4FF",
    fontSize: 13,
    fontFamily: fonts.bodySemi,
  },
  metricValue: {
    color: palette.text,
    fontFamily: fonts.title,
    fontSize: 30,
  },
  metricLabel: {
    marginTop: 4,
    color: palette.sky700,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    textTransform: "capitalize",
  },
  infoText: {
    marginTop: 6,
    color: palette.textSoft,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  col: {
    flex: 1,
  },
});

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
  const sourceIcon = reading?.sourceNow === "WIND" ? "weather-windy" : reading?.sourceNow === "BATTERY" ? "battery" : "transmission-tower";
  const connectionLevel = !apiReachable ? "stop" : isConnectedRealtime ? "ok" : "warn";
  const connectionText = !apiReachable
    ? "Sin senal"
    : isConnectedRealtime
      ? "Conectado en tiempo real"
      : "Conectado (actualiza cada 5s)";
  const windAction =
    (reading?.windSpeedMs ?? 0) < 3
      ? "Prioriza cargas esenciales hasta que suba el viento."
      : (reading?.windSpeedMs ?? 0) > 20
        ? "Mantener parada por seguridad hasta que baje el viento."
        : "Buen momento para usar bomba de agua y cargar bateria.";

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.page}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={palette.sky700} />}
        contentContainerStyle={[styles.content, { paddingBottom: contentPaddingBottom }]}
      >
        <LinearGradient colors={[palette.sky700, palette.sky500]} style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <MaterialCommunityIcons name="fan" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>Aerogenerador - Parcela Norte</Text>
          <Text style={styles.heroSub}>Ultima actualizacion: {timeAgo(lastSyncAt)}</Text>
          <StatusTag level={connectionLevel} text={connectionText} />
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
          <View style={styles.iconLine}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={16} color={palette.textSoft} />
            <Text style={styles.iconLineText}>Revisa esta tarjeta primero para decidir acciones del dia.</Text>
          </View>
        </Panel>

        <Panel
          title="Estado del viento"
          subtitle="Anemometro"
          rightSlot={<MaterialCommunityIcons name="weather-windy" size={24} color={palette.sky700} />}
        >
          <Text style={styles.metricValue}>{round(reading?.windSpeedMs)} m/s</Text>
          <Text style={styles.metricLabel}>{wind.label}</Text>
          <Text style={styles.infoText}>{wind.message}</Text>
          <View style={styles.iconLine}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color={palette.textSoft} />
            <Text style={styles.iconLineText}>{windAction}</Text>
          </View>
        </Panel>

        <Panel
          title="Energia generada hoy"
          subtitle="Produccion acumulada"
          rightSlot={<MaterialCommunityIcons name="flash" size={24} color={palette.sky700} />}
        >
          <Text style={styles.metricValue}>{round(reading?.energyTodayKwh, 2)} kWh</Text>
          <Text style={styles.infoText}>Equivale a cargar {equivalents.phones} celulares.</Text>
          <Text style={styles.infoText}>Tambien alcanza para luces del campo por {equivalents.fieldLightsHours} horas.</Text>
          <View style={styles.iconLine}>
            <MaterialCommunityIcons name="calendar-clock-outline" size={16} color={palette.textSoft} />
            <Text style={styles.iconLineText}>Aprovecha entre 11:00 y 14:00 para cargas de mayor consumo.</Text>
          </View>
        </Panel>

        <Panel
          title="Nivel de bateria"
          subtitle="Almacenamiento actual"
          rightSlot={<MaterialCommunityIcons name="battery-high" size={24} color={palette.sky700} />}
        >
          <Text style={styles.metricValue}>{round(reading?.batteryPct, 0)}%</Text>
          <Text style={styles.infoText}>
            Autonomia aproximada: {autonomyHours === null ? "--" : `${round(autonomyHours, 1)} horas`}
          </Text>
          <View style={styles.iconLine}>
            <MaterialCommunityIcons name="alert-outline" size={16} color={palette.textSoft} />
            <Text style={styles.iconLineText}>Si baja de 20%, reduce consumo electrico alrededor de 10%.</Text>
          </View>
        </Panel>

        <Panel
          title="Fuente actual de energia"
          subtitle={sourceLabel(reading?.sourceNow)}
          rightSlot={<MaterialCommunityIcons name={sourceIcon as any} size={24} color={palette.sky700} />}
        >
          <Text style={styles.infoText}>{reading?.sourceReason || "Esperando datos para determinar origen de energia."}</Text>
        </Panel>

        <View style={styles.row}>
          <View style={styles.col}>
            <Panel
              title="Estado electrico"
              subtitle="Basado en voltaje"
              rightSlot={<MaterialCommunityIcons name="transmission-tower" size={22} color={palette.sky700} />}
            >
              <StatusTag level={voltage.level} text={voltage.label} />
            </Panel>
          </View>
          <View style={styles.col}>
            <Panel
              title="Consumo actual"
              subtitle="Demanda del sistema"
              rightSlot={<MaterialCommunityIcons name="home-lightning-bolt-outline" size={22} color={palette.sky700} />}
            >
              <Text style={[styles.metricValue, { fontSize: 24 }]}>{round(reading?.loadPowerW, 0)} W</Text>
            </Panel>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Panel
              title="Temperatura"
              subtitle="Generador"
              rightSlot={<MaterialCommunityIcons name="thermometer" size={22} color={palette.sky700} />}
            >
              <StatusTag level={temp.level} text={temp.label} />
            </Panel>
          </View>
          <View style={styles.col}>
            <Panel
              title="Vibracion"
              subtitle="Estado mecanico"
              rightSlot={<MaterialCommunityIcons name="vibrate" size={22} color={palette.sky700} />}
            >
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
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    shadowColor: "#02679C",
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
    fontSize: 22,
    fontFamily: fonts.title,
    textAlign: "center",
  },
  heroSub: {
    color: "#DDF4FF",
    fontSize: 13,
    fontFamily: fonts.bodySemi,
    textAlign: "center",
  },
  metricValue: {
    color: palette.text,
    fontFamily: fonts.title,
    fontSize: 30,
    textAlign: "center",
  },
  metricLabel: {
    marginTop: 4,
    color: palette.sky700,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    textTransform: "capitalize",
    textAlign: "center",
  },
  infoText: {
    marginTop: 6,
    color: palette.textSoft,
    fontFamily: fonts.body,
    lineHeight: 20,
    textAlign: "center",
  },
  iconLine: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 6,
    width: "100%",
  },
  iconLineText: {
    color: palette.textSoft,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: "90%",
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  col: {
    flex: 1,
  },
});

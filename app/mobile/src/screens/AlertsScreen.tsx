import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ENV } from "../config/env";
import { Panel } from "../components/Panel";
import { StatusTag } from "../components/StatusTag";
import { useAero } from "../state/AeroContext";
import { fonts, palette, radius, spacing } from "../theme";
import { sortAlertsByDate, timeAgo } from "../utils/format";

const alertMeta: Record<string, { icon: string; level: "ok" | "warn" | "stop"; title: string }> = {
  wind_danger: { icon: "weather-windy", level: "stop", title: "Viento peligroso" },
  generator_temp_high: { icon: "thermometer-high", level: "stop", title: "Temperatura alta" },
  vibration_high: { icon: "vibrate", level: "warn", title: "Vibracion elevada" },
  battery_low: { icon: "battery-alert", level: "warn", title: "Bateria baja" },
};

export const AlertsScreen = () => {
  const { alerts, ackedAlerts, markAlertReceived } = useAero();
  const sorted = sortAlertsByDate(alerts);

  const callSupport = async () => {
    const url = `tel:${ENV.supportPhone.replace(/\s+/g, "")}`;
    await Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <LinearGradient colors={["#0EA5E9", "#38BDF8"]} style={styles.hero}>
        <Text style={styles.heroTitle}>Alertas del sistema</Text>
        <Text style={styles.heroSub}>Eventos importantes en tiempo real para la parcela.</Text>
      </LinearGradient>

      {!sorted.length ? (
        <Panel title="Sin alertas recientes" subtitle="Estado estable">
          <Text style={styles.emptyText}>No se detectaron alertas para este dispositivo en los ultimos minutos.</Text>
        </Panel>
      ) : null}

      {sorted.map((alert) => {
        const meta = alertMeta[alert.type] || {
          icon: "alert-circle-outline",
          level: "warn" as const,
          title: "Evento del sistema",
        };
        const received = ackedAlerts[alert.id] || alert.status !== "open";

        return (
          <Panel
            key={alert.id}
            title={meta.title}
            subtitle={timeAgo(alert.createdAt)}
            rightSlot={<MaterialCommunityIcons name={meta.icon as any} size={24} color={palette.sky700} />}
          >
            <Text style={styles.message}>{alert.message}</Text>
            <View style={styles.metaRow}>
              <StatusTag level={meta.level} text={received ? "Recibido" : "Pendiente"} />
              <Text style={styles.smallText}>ID: {alert.id.slice(0, 8)}</Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={() => markAlertReceived(alert.id)}
                style={[styles.button, styles.primaryBtn, received && styles.primaryBtnDisabled]}
              >
                <Text style={styles.primaryBtnText}>{received ? "Recibido" : "Marcar recibido"}</Text>
              </Pressable>
              <Pressable onPress={() => void callSupport()} style={[styles.button, styles.secondaryBtn]}>
                <Text style={styles.secondaryBtnText}>Llamar soporte</Text>
              </Pressable>
            </View>
          </Panel>
        );
      })}
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
    borderColor: "#77D6FF",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.title,
    fontSize: 22,
  },
  heroSub: {
    marginTop: 4,
    color: "#EAF8FF",
    fontFamily: fonts.body,
  },
  emptyText: {
    color: palette.textSoft,
    fontFamily: fonts.body,
  },
  message: {
    color: palette.text,
    fontFamily: fonts.bodySemi,
    lineHeight: 22,
  },
  smallText: {
    color: palette.textSoft,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  metaRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actions: {
    marginTop: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    backgroundColor: palette.sky700,
  },
  primaryBtnDisabled: {
    backgroundColor: "#4FB4E3",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#FFFFFF",
  },
  secondaryBtnText: {
    color: palette.text,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
  },
});

import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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

const actionByAlertType: Record<string, { icon: string; text: string }> = {
  wind_danger: {
    icon: "pause-circle-outline",
    text: "Mantener el sistema detenido hasta que el viento vuelva a rango seguro.",
  },
  generator_temp_high: {
    icon: "thermometer-low",
    text: "Esperar enfriamiento del generador antes de reanudar operacion.",
  },
  vibration_high: {
    icon: "wrench-outline",
    text: "Programar revision de aspas y soportes en la siguiente visita tecnica.",
  },
  battery_low: {
    icon: "battery-charging-low",
    text: "Reducir consumo cerca de 10% y priorizar cargas esenciales.",
  },
};

export const AlertsScreen = () => {
  const { alerts, ackedAlerts, markAlertReceived } = useAero();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const sorted = sortAlertsByDate(alerts);
  const pendingAlerts = sorted.filter((alert) => alert.status === "open" && !ackedAlerts[alert.id]);
  const contentPaddingBottom = spacing.xl + tabBarHeight + insets.bottom;

  const callSupport = async () => {
    const url = `tel:${ENV.supportPhone.replace(/[^\d+]/g, "")}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert("Soporte", `No se pudo abrir la llamada. Marca manualmente: ${ENV.supportPhone}`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Soporte", `No se pudo abrir la llamada. Marca manualmente: ${ENV.supportPhone}`);
    }
  };

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: contentPaddingBottom }]}>
        <LinearGradient colors={["#0EA5E9", "#38BDF8"]} style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <MaterialCommunityIcons name="bell-alert" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>Alertas del sistema</Text>
          <Text style={styles.heroSub}>Mensajes importantes para decidir acciones rapidas en campo.</Text>
        </LinearGradient>

        {!pendingAlerts.length ? (
          <Panel
            title="Sin alertas pendientes"
            subtitle="Estado estable"
            rightSlot={<MaterialCommunityIcons name="check-decagram-outline" size={24} color={palette.good} />}
          >
            <Text style={styles.emptyText}>No hay alertas activas por atender en este momento.</Text>
          </Panel>
        ) : null}

        {pendingAlerts.map((alert) => {
          const meta = alertMeta[alert.type] || {
            icon: "alert-circle-outline",
            level: "warn" as const,
            title: "Evento del sistema",
          };
          const action = actionByAlertType[alert.type] || {
            icon: "information-outline",
            text: "Revisar la condicion y avisar a soporte si persiste.",
          };

          return (
            <Panel
              key={alert.id}
              title={meta.title}
              subtitle={timeAgo(alert.createdAt)}
              rightSlot={<MaterialCommunityIcons name={meta.icon as any} size={24} color={palette.sky700} />}
            >
              <Text style={styles.message}>{alert.message}</Text>
              <View style={styles.metaRow}>
                <StatusTag level={meta.level} text="Pendiente" />
                <Text style={styles.smallText}>{timeAgo(alert.createdAt)}</Text>
              </View>

              <View style={styles.actionNote}>
                <MaterialCommunityIcons name={action.icon as any} size={16} color={palette.textSoft} />
                <Text style={styles.actionText}>{action.text}</Text>
              </View>

              <View style={styles.actions}>
                <Pressable onPress={() => markAlertReceived(alert.id)} style={[styles.button, styles.primaryBtn]}>
                  <Text style={styles.primaryBtnText}>Marcar recibido</Text>
                </Pressable>
                <Pressable onPress={() => void callSupport()} style={[styles.button, styles.secondaryBtn]}>
                  <Text style={styles.secondaryBtnText}>Llamar soporte</Text>
                </Pressable>
              </View>
            </Panel>
          );
        })}
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
    borderColor: "#77D6FF",
    alignItems: "center",
    gap: 6,
    shadowColor: "#0E7EA8",
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
    color: "#EAF8FF",
    fontFamily: fonts.body,
    textAlign: "center",
  },
  emptyText: {
    color: palette.textSoft,
    fontFamily: fonts.body,
    textAlign: "center",
  },
  message: {
    color: palette.text,
    fontFamily: fonts.bodySemi,
    lineHeight: 22,
    textAlign: "center",
  },
  smallText: {
    color: palette.textSoft,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "center",
  },
  metaRow: {
    marginTop: spacing.sm,
    gap: 8,
    alignItems: "center",
  },
  actionNote: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 6,
    width: "100%",
  },
  actionText: {
    color: palette.textSoft,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: "92%",
  },
  actions: {
    marginTop: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
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
  primaryBtnText: {
    color: "#FFFFFF",
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    textAlign: "center",
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
    textAlign: "center",
  },
});

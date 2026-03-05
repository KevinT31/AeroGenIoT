import React, { useMemo } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Panel } from "../components/Panel";
import { useAero } from "../state/AeroContext";
import { fonts, palette, radius, spacing } from "../theme";
import { energyEquivalences, round, weeklyEnergySeries } from "../utils/format";

export const ProductionScreen = () => {
  const { reading } = useAero();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const todayKwh = Number(reading?.energyTodayKwh || 0);
  const equivalent = energyEquivalences(todayKwh);
  const weekly = useMemo(() => weeklyEnergySeries(todayKwh), [todayKwh]);
  const maxValue = Math.max(...weekly.map((item) => item.kwh), 0.1);
  const bestIndex = weekly.findIndex((item) => item.kwh === maxValue);
  const bestDay = weekly[Math.max(0, bestIndex)]?.label || "D";
  const contentPaddingBottom = spacing.xl + tabBarHeight + insets.bottom;

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: contentPaddingBottom }]}>
        <LinearGradient colors={["#0891B2", "#38BDF8"]} style={styles.hero}>
          <Text style={styles.heroTitle}>Produccion del aerogenerador</Text>
          <Text style={styles.heroSub}>Rendimiento diario y tendencia semanal.</Text>
        </LinearGradient>

        <Panel title="Energia generada hoy" subtitle="Acumulado diario">
          <Text style={styles.energyValue}>{round(todayKwh, 2)} kWh</Text>
          <Text style={styles.infoText}>Suficiente para cargar {equivalent.phones} celulares.</Text>
          <Text style={styles.infoText}>Tambien cubre luces del campo por {equivalent.fieldLightsHours} horas aprox.</Text>
        </Panel>

        <Panel title="Energia semanal" subtitle="Ultimos 7 dias (estimado)">
          <View style={styles.chart}>
            {weekly.map((item) => {
              const height = Math.max(18, (item.kwh / maxValue) * 120);
              return (
                <View key={item.label} style={styles.barCol}>
                  <View style={[styles.bar, { height }]} />
                  <Text style={styles.barLabel}>{item.label}</Text>
                  <Text style={styles.barValue}>{round(item.kwh, 1)}</Text>
                </View>
              );
            })}
          </View>
        </Panel>

        <Panel title="Hora de mayor generacion" subtitle="Patron esperado">
          <Text style={styles.energyValueSmall}>11:00 - 14:00</Text>
          <Text style={styles.infoText}>
            Mejor rendimiento semanal en dia {bestDay}. Se recomienda priorizar cargas en ese bloque.
          </Text>
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
    borderColor: "#74DEFF",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.title,
    fontSize: 22,
  },
  heroSub: {
    marginTop: 4,
    color: "#DFF7FF",
    fontFamily: fonts.body,
  },
  energyValue: {
    color: palette.text,
    fontSize: 34,
    fontFamily: fonts.title,
  },
  energyValueSmall: {
    color: palette.text,
    fontSize: 28,
    fontFamily: fonts.title,
  },
  infoText: {
    marginTop: 6,
    color: palette.textSoft,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  chart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: spacing.xs,
    minHeight: 160,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  bar: {
    width: "88%",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: "#4CC9FF",
    borderWidth: 1,
    borderColor: "#2BA7D8",
  },
  barLabel: {
    color: palette.textSoft,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
  },
  barValue: {
    color: palette.text,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
});

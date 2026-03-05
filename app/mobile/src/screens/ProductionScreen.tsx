import React, { useMemo } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
          <View style={styles.heroIconWrap}>
            <MaterialCommunityIcons name="chart-line" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>Produccion del aerogenerador</Text>
          <Text style={styles.heroSub}>Resumen para planificar uso de energia en la parcela.</Text>
        </LinearGradient>

        <Panel
          title="Energia generada hoy"
          subtitle="Acumulado diario"
          rightSlot={<MaterialCommunityIcons name="flash-outline" size={24} color={palette.sky700} />}
        >
          <Text style={styles.energyValue}>{round(todayKwh, 2)} kWh</Text>
          <Text style={styles.infoText}>Suficiente para cargar {equivalent.phones} celulares.</Text>
          <Text style={styles.infoText}>Tambien cubre luces del campo por {equivalent.fieldLightsHours} horas aprox.</Text>
          <View style={styles.iconLine}>
            <MaterialCommunityIcons name="water-pump" size={16} color={palette.textSoft} />
            <Text style={styles.iconLineText}>Si hoy sube este valor, aprovecha para bombear y regar temprano.</Text>
          </View>
        </Panel>

        <Panel
          title="Energia semanal"
          subtitle="Ultimos 7 dias (estimado)"
          rightSlot={<MaterialCommunityIcons name="calendar-week-outline" size={24} color={palette.sky700} />}
        >
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
          <View style={styles.iconLine}>
            <MaterialCommunityIcons name="trending-up" size={16} color={palette.textSoft} />
            <Text style={styles.iconLineText}>Si cae 2 dias seguidos, conviene revisar aspas o sombra cercana.</Text>
          </View>
        </Panel>

        <Panel
          title="Hora de mayor generacion"
          subtitle="Patron esperado"
          rightSlot={<MaterialCommunityIcons name="clock-time-eight-outline" size={24} color={palette.sky700} />}
        >
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
    alignItems: "center",
    gap: 6,
    shadowColor: "#0C7FA1",
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
    color: "#DFF7FF",
    fontFamily: fonts.body,
    textAlign: "center",
  },
  energyValue: {
    color: palette.text,
    fontSize: 34,
    fontFamily: fonts.title,
    textAlign: "center",
  },
  energyValueSmall: {
    color: palette.text,
    fontSize: 28,
    fontFamily: fonts.title,
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
    marginTop: 8,
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
    maxWidth: "92%",
  },
  chart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: spacing.xs,
    minHeight: 160,
    width: "100%",
    backgroundColor: "#F7FBFF",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
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
    textAlign: "center",
  },
  barValue: {
    color: palette.text,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textAlign: "center",
  },
});

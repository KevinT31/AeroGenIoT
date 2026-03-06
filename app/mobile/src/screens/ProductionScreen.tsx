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
import { useI18n } from "../i18n/LanguageContext";

export const ProductionScreen = () => {
  const { reading } = useAero();
  const { language, t } = useI18n();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const todayKwh = Number(reading?.energyTodayKwh || 0);
  const equivalent = energyEquivalences(todayKwh);
  const weekly = useMemo(() => weeklyEnergySeries(todayKwh, language), [todayKwh, language]);
  const maxValue = Math.max(...weekly.map((item) => item.kwh), 0.1);
  const bestIndex = weekly.findIndex((item) => item.kwh === maxValue);
  const bestDay = weekly[Math.max(0, bestIndex)]?.label || "D";
  const minValue = Math.min(...weekly.map((item) => item.kwh));
  const minDay = weekly.find((item) => item.kwh === minValue)?.label || "D";
  const avgValue = weekly.reduce((acc, item) => acc + item.kwh, 0) / Math.max(1, weekly.length);
  const contentPaddingBottom = spacing.xl + tabBarHeight + insets.bottom;

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: contentPaddingBottom }]}>
        <LinearGradient colors={["#0891B2", "#38BDF8"]} style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <MaterialCommunityIcons name="chart-line" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>{t("production.hero.title")}</Text>
          <Text style={styles.heroSub}>{t("production.hero.subtitle")}</Text>
        </LinearGradient>

        <Panel
          title={t("production.today.title")}
          subtitle={t("production.today.subtitle")}
          rightSlot={<MaterialCommunityIcons name="flash-outline" size={24} color={palette.sky700} />}
        >
          <Text style={styles.energyValue}>{round(todayKwh, 2)} kWh</Text>
          <Text style={styles.infoText}>{t("production.today.phones", { phones: equivalent.phones })}</Text>
          <Text style={styles.infoText}>{t("production.today.lights", { hours: equivalent.fieldLightsHours })}</Text>
        </Panel>

        <Panel
          title={t("production.weekly.title")}
          subtitle={t("production.weekly.subtitle")}
          rightSlot={<MaterialCommunityIcons name="calendar-week-outline" size={24} color={palette.sky700} />}
        >
          <View style={styles.chart}>
            {weekly.map((item, index) => {
              const height = Math.max(18, (item.kwh / maxValue) * 120);
              return (
                <View key={`${item.label}-${index}`} style={styles.barCol}>
                  <View style={[styles.bar, { height }]} />
                  <Text style={styles.barLabel}>{item.label}</Text>
                  <Text style={styles.barValue}>{round(item.kwh, 1)}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.iconLine}>
            <MaterialCommunityIcons name="trending-up" size={16} color={palette.textSoft} />
            <Text style={styles.iconLineText}>
              {t("production.weekly.summary", {
                avg: round(avgValue, 2),
                bestDay,
                max: round(maxValue, 2),
                minDay,
                min: round(minValue, 2),
              })}
            </Text>
          </View>
        </Panel>

        <Panel
          title={t("production.peak.title")}
          subtitle={t("production.peak.subtitle")}
          rightSlot={<MaterialCommunityIcons name="clock-time-eight-outline" size={24} color={palette.sky700} />}
        >
          <Text style={styles.energyValueSmall}>{t("production.peak.window")}</Text>
          <Text style={styles.infoText}>{t("production.peak.tip", { day: bestDay })}</Text>
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


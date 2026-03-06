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
import { useI18n } from "../i18n/LanguageContext";
import { SourceNow } from "../types/aerogen";

const levelColor = {
  ok: palette.good,
  warn: palette.warn,
  stop: palette.danger,
};

export const HomeScreen = () => {
  const { reading, alerts, ackedAlerts, loading, apiReachable, lastSyncAt, refresh } = useAero();
  const { language, t } = useI18n();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const status = systemState(reading, language);
  const wind = windState(reading?.windSpeedMs, language);
  const temp = temperatureState(reading?.genTempC, language);
  const vibration = vibrationState(reading?.vibrationRms, language);
  const voltage = voltageState(reading?.genVoltageV, language);
  const autonomyHours = estimateAutonomyHours(reading?.batteryPct, reading?.loadPowerW, ENV.batteryCapacityKwh);
  const activeAlerts = alerts.filter((alert) => alert.status === "open" && !ackedAlerts[alert.id]);
  const contentPaddingBottom = spacing.xl + tabBarHeight + insets.bottom;
  const sourceIcon =
    reading?.sourceNow === "WIND" ? "weather-windy" : reading?.sourceNow === "BATTERY" ? "battery" : "transmission-tower";
  const connectionLevel = apiReachable ? "ok" : "stop";
  const connectionText = apiReachable ? t("common.connected") : t("common.noSignal");
  const alertTitleByType: Record<string, string> = {
    wind_danger: t("alerts.type.wind_danger"),
    generator_temp_high: t("alerts.type.generator_temp_high"),
    vibration_high: t("alerts.type.vibration_high"),
    battery_low: t("alerts.type.battery_low"),
  };
  const sourceReasonBySource: Record<SourceNow, string> = {
    WIND: t("home.source.reason.WIND"),
    BATTERY: t("home.source.reason.BATTERY"),
    BOTH: t("home.source.reason.BOTH"),
  };
  const sourceReason = reading?.sourceNow ? sourceReasonBySource[reading.sourceNow] : t("home.source.waiting");

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
          <Text style={styles.heroTitle}>{t("home.hero.title")}</Text>
          <Text style={styles.heroSub}>{t("home.hero.updated", { time: timeAgo(lastSyncAt, language) })}</Text>
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
                ? t("home.systemTag.ok")
                : status.level === "warn"
                  ? t("home.systemTag.warn")
                  : t("home.systemTag.stop")
            }
          />
        </Panel>

        <Panel
          title={t("home.activeAlerts.title")}
          subtitle={
            activeAlerts.length
              ? t("home.activeAlerts.subtitleCount", { count: activeAlerts.length })
              : t("home.activeAlerts.subtitleNone")
          }
          rightSlot={<MaterialCommunityIcons name="bell-alert-outline" size={24} color={activeAlerts.length ? palette.warn : palette.good} />}
        >
          {!activeAlerts.length ? (
            <Text style={styles.infoText}>{t("home.activeAlerts.noneText")}</Text>
          ) : (
            <View style={styles.alertList}>
              {activeAlerts.map((alert) => (
                <View key={alert.id} style={styles.alertItem}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={16} color={palette.warn} />
                  <Text style={styles.alertText}>{alertTitleByType[alert.type] || t("common.systemEvent")}</Text>
                </View>
              ))}
            </View>
          )}
        </Panel>

        <Panel
          title={t("home.wind.title")}
          subtitle={t("home.wind.subtitle")}
          rightSlot={<MaterialCommunityIcons name="weather-windy" size={24} color={palette.sky700} />}
        >
          <Text style={styles.metricValue}>{round(reading?.windSpeedMs)} m/s</Text>
          <Text style={styles.metricLabel}>{wind.label}</Text>
          <Text style={styles.infoText}>{wind.message}</Text>
        </Panel>

        <Panel
          title={t("home.energy.title")}
          subtitle={t("home.energy.subtitle")}
          rightSlot={<MaterialCommunityIcons name="flash" size={24} color={palette.sky700} />}
        >
          <Text style={styles.metricValue}>{round(reading?.energyTodayKwh, 2)} kWh</Text>
          <Text style={styles.infoText}>{t("home.energy.info")}</Text>
        </Panel>

        <Panel
          title={t("home.battery.title")}
          subtitle={t("home.battery.subtitle")}
          rightSlot={<MaterialCommunityIcons name="battery-high" size={24} color={palette.sky700} />}
        >
          <Text style={styles.metricValue}>{round(reading?.batteryPct, 0)}%</Text>
          <Text style={styles.infoText}>
            {t("home.battery.autonomy", {
              hours: autonomyHours === null ? "--" : `${round(autonomyHours, 1)} h`,
            })}
          </Text>
          <View style={styles.iconLine}>
            <MaterialCommunityIcons name="alert-outline" size={16} color={palette.textSoft} />
            <Text style={styles.iconLineText}>{t("home.battery.tip")}</Text>
          </View>
        </Panel>

        <Panel
          title={t("home.source.title")}
          subtitle={sourceLabel(reading?.sourceNow, language)}
          rightSlot={<MaterialCommunityIcons name={sourceIcon as any} size={24} color={palette.sky700} />}
        >
          <Text style={styles.infoText}>{sourceReason}</Text>
        </Panel>

        <View style={styles.row}>
          <View style={styles.col}>
            <Panel
              title={t("home.electrical.title")}
              subtitle={t("home.electrical.subtitle")}
              rightSlot={<MaterialCommunityIcons name="transmission-tower" size={22} color={palette.sky700} />}
            >
              <StatusTag level={voltage.level} text={voltage.label} />
            </Panel>
          </View>
          <View style={styles.col}>
            <Panel
              title={t("home.consumption.title")}
              subtitle={t("home.consumption.subtitle")}
              rightSlot={<MaterialCommunityIcons name="home-lightning-bolt-outline" size={22} color={palette.sky700} />}
            >
              <Text style={[styles.metricValue, { fontSize: 24 }]}>{round(reading?.loadPowerW, 0)} W</Text>
            </Panel>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Panel
              title={t("home.temperature.title")}
              subtitle={t("home.temperature.subtitle")}
              rightSlot={<MaterialCommunityIcons name="thermometer" size={22} color={palette.sky700} />}
            >
              <StatusTag level={temp.level} text={temp.label} />
            </Panel>
          </View>
          <View style={styles.col}>
            <Panel
              title={t("home.vibration.title")}
              subtitle={t("home.vibration.subtitle")}
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
  alertList: {
    width: "100%",
    gap: 8,
  },
  alertItem: {
    width: "100%",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    backgroundColor: "#F7FBFF",
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  alertText: {
    color: palette.text,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  col: {
    flex: 1,
  },
});


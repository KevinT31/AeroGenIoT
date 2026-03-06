import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Panel } from "../components/Panel";
import { StatusTag } from "../components/StatusTag";
import { useAero } from "../state/AeroContext";
import { fonts, palette, radius, spacing } from "../theme";
import { round, sourceLabel, systemState, temperatureState, vibrationState, windState } from "../utils/format";
import { useI18n } from "../i18n/LanguageContext";
import { AppLanguage } from "../i18n/translations";
import { SourceNow } from "../types/aerogen";

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
  const { language, setLanguage, t } = useI18n();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const system = systemState(reading, language);
  const wind = windState(reading?.windSpeedMs, language);
  const temp = temperatureState(reading?.genTempC, language);
  const vibration = vibrationState(reading?.vibrationRms, language);
  const contentPaddingBottom = spacing.xl + tabBarHeight + insets.bottom;
  const windSpeed = reading?.windSpeedMs ?? 0;
  const windLevel: "ok" | "warn" | "stop" = windSpeed > 20 ? "stop" : windSpeed >= 3 && windSpeed <= 12 ? "ok" : "warn";
  const sourceReasonBySource: Record<SourceNow, string> = {
    WIND: t("home.source.reason.WIND"),
    BATTERY: t("home.source.reason.BATTERY"),
    BOTH: t("home.source.reason.BOTH"),
  };
  const sourceReason = reading?.sourceNow ? sourceReasonBySource[reading.sourceNow] : t("technical.source.noData");

  const languageOptions: Array<{ code: AppLanguage; key: string }> = [
    { code: "es", key: "language.es" },
    { code: "en", key: "language.en" },
    { code: "qu", key: "language.qu" },
  ];

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: contentPaddingBottom }]}>
        <LinearGradient colors={["#0369A1", "#0EA5E9"]} style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <MaterialCommunityIcons name="tools" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>{t("technical.hero.title")}</Text>
          <Text style={styles.heroSub}>{t("technical.hero.subtitle")}</Text>
        </LinearGradient>

        <Panel
          title={t("technical.system.title")}
          rightSlot={<MaterialCommunityIcons name="shield-check-outline" size={24} color={palette.sky700} />}
        >
          <StatusTag level={system.level} text={system.title} />
          <Text style={styles.helpText}>{system.message}</Text>
        </Panel>

        <Panel title={t("technical.sensors.title")} rightSlot={<MaterialCommunityIcons name="access-point-network" size={24} color={palette.sky700} />}>
          <View style={styles.sensorGrid}>
            <Row icon="weather-windy" label={t("technical.sensor.wind")} value={round(reading?.windSpeedMs)} unit="m/s" />
            <Row icon="sine-wave" label={t("technical.sensor.voltage")} value={round(reading?.genVoltageV)} unit="V" />
            <Row icon="current-ac" label={t("technical.sensor.current")} value={round(reading?.genCurrentA)} unit="A" />
            <Row icon="flash-outline" label={t("technical.sensor.power")} value={round(reading?.powerW)} unit="W" />
            <Row icon="thermometer" label={t("technical.sensor.temp")} value={round(reading?.genTempC)} unit="C" />
            <Row icon="vibrate" label={t("technical.sensor.vibration")} value={round(reading?.vibrationRms)} unit="m/s2" />
            <Row icon="battery-high" label={t("technical.sensor.battery")} value={round(reading?.batteryPct, 0)} unit="%" />
          </View>
        </Panel>

        <Panel
          title={t("technical.source.title")}
          subtitle={sourceLabel(reading?.sourceNow, language)}
          rightSlot={<MaterialCommunityIcons name="transmission-tower" size={24} color={palette.sky700} />}
        >
          <Text style={styles.helpText}>{sourceReason}</Text>
          <View style={styles.tagRow}>
            <StatusTag level={windLevel} text={t("technical.tag.wind", { value: wind.label })} />
          </View>
          <View style={styles.tagRow}>
            <StatusTag level={temp.level} text={t("technical.tag.temp", { value: temp.label })} />
          </View>
          <View style={styles.tagRow}>
            <StatusTag level={vibration.level} text={t("technical.tag.vibration", { value: vibration.label })} />
          </View>
        </Panel>

        <Panel
          title={t("language.panel.title")}
          subtitle={t("language.panel.subtitle")}
          rightSlot={<MaterialCommunityIcons name="translate" size={24} color={palette.sky700} />}
        >
          <View style={styles.languageRow}>
            {languageOptions.map((option) => {
              const isActive = language === option.code;
              return (
                <Pressable
                  key={option.code}
                  style={[styles.languageChip, isActive ? styles.languageChipActive : null]}
                  onPress={() => setLanguage(option.code)}
                >
                  <Text style={[styles.languageChipText, isActive ? styles.languageChipTextActive : null]}>{t(option.key)}</Text>
                </Pressable>
              );
            })}
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
  languageRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  languageChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#F7FBFF",
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  languageChipActive: {
    backgroundColor: palette.sky700,
    borderColor: palette.sky700,
  },
  languageChipText: {
    color: palette.text,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    textAlign: "center",
  },
  languageChipTextActive: {
    color: "#FFFFFF",
  },
});

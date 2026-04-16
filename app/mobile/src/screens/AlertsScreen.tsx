import React, { useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { HeroBanner } from "../components/HeroBanner";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import { ScreenLayout } from "../components/ScreenLayout";
import { StatusTag } from "../components/StatusTag";
import { useI18n } from "../i18n/LanguageContext";
import { deviceStatusService } from "../services/deviceStatusService";
import { supportService } from "../services/supportService";
import { useAero } from "../state/AeroContext";
import { fonts, palette, radius, spacing } from "../theme";
import { sortAlertsByDate, timeAgo } from "../utils/format";

const iconByType: Record<string, string> = {
  battery_critical: "battery-alert-variant-outline",
  battery_overtemperature: "battery-heart-variant",
  system_overload: "transmission-tower-export",
  supply_cut: "power-plug-off-outline",
  inverter_fault: "alert-octagon-outline",
  low_wind: "weather-windy-variant",
  high_wind: "weather-windy",
  rotor_rpm_high: "rotate-3d-variant",
  inverter_temp_high: "thermometer-high",
  vibration_high: "vibrate",
  battery_low: "battery-alert",
};

export const AlertsScreen = () => {
  const { alerts, pendingAlerts, markAlertReceived } = useAero();
  const { language, t } = useI18n();
  const [workingAlertId, setWorkingAlertId] = useState<string | null>(null);
  const sortedAlerts = useMemo(() => sortAlertsByDate(alerts), [alerts]);
  const recentHandled = sortedAlerts.filter((alert) => alert.status !== "open").slice(0, 3);
  const criticalCount = pendingAlerts.filter((alert) => alert.severity === "stop").length;
  const warningCount = pendingAlerts.filter((alert) => alert.severity === "warn").length;

  const callSupport = async () => {
    try {
      const result = await supportService.callPrimaryContact();
      if (!result.ok) {
        Alert.alert(t("alerts.support.title"), t("alerts.support.error", { phone: result.contact.displayPhone }));
      }
    } catch {
      const contact = supportService.getPrimaryContact();
      Alert.alert(t("alerts.support.title"), t("alerts.support.error", { phone: contact.displayPhone }));
    }
  };

  const handleReceived = async (alertId: string) => {
    setWorkingAlertId(alertId);
    const success = await markAlertReceived(alertId);
    setWorkingAlertId(null);
    if (!success) {
      Alert.alert(t("alerts.support.title"), t("alerts.received.error"));
    }
  };

  return (
    <ScreenLayout>
      <HeroBanner icon="bell-alert" title={t("alerts.hero.title")} colors={["#0B6E99", "#1BA3D2"]} />

      <View style={styles.metricGrid}>
        <MetricCard
          icon="alert-octagon-outline"
          title={t("alerts.hero.pendingCount")}
          value={String(pendingAlerts.length)}
          helper={pendingAlerts.length ? t("alerts.hero.pendingMessage") : t("alerts.none.subtitle")}
          tone={pendingAlerts.length ? "warn" : "good"}
        />
        <MetricCard
          icon="shield-alert-outline"
          title={t("alerts.hero.priorityCount")}
          value={String(criticalCount + warningCount)}
          helper={t("alerts.hero.priorityMessage")}
          tone={criticalCount ? "danger" : warningCount ? "warn" : "good"}
        />
      </View>

      {!pendingAlerts.length ? (
        <Panel
          title={t("alerts.none.title")}
          subtitle={t("alerts.none.subtitle")}
          align="center"
          centerHeaderText
          rightSlot={<MaterialCommunityIcons name="check-decagram-outline" size={22} color={palette.good} />}
        >
          <Text style={styles.centerText}>{t("alerts.none.text")}</Text>
          <Pressable onPress={() => void callSupport()} style={[styles.button, styles.secondaryBtn, styles.singleButton]}>
            <Text style={styles.secondaryBtnText}>{t("alerts.button.support")}</Text>
          </Pressable>
        </Panel>
      ) : null}

      {pendingAlerts.map((alert) => {
        const presentation = deviceStatusService.getAlertPresentation(alert, language);
        const iconName = iconByType[alert.type] || "alert-circle-outline";
        const isBusy = workingAlertId === alert.id;

        return (
          <Panel
            key={alert.id}
            title={presentation.title}
            rightSlot={<MaterialCommunityIcons name={iconName as any} size={22} color={palette.sky700} />}
            tone="soft"
          >
            <View style={styles.alertHeaderRow}>
              <StatusTag level={presentation.severity} text={presentation.severity === "stop" ? t("alerts.tag.high") : t("alerts.tag.medium")} />
              <Text style={styles.detectedText}>{t("alerts.card.detected", { time: timeAgo(alert.createdAt, language) })}</Text>
            </View>
            <Text style={styles.alertMessage}>{alert.message || presentation.message}</Text>

            <View style={styles.noteBox}>
              <MaterialCommunityIcons name="lightbulb-outline" size={16} color={palette.textSoft} />
              <Text style={styles.noteText}>
                <Text style={styles.noteLabel}>{t("alerts.card.recommendation")} </Text>
                {presentation.action}
              </Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={() => void handleReceived(alert.id)}
                style={[styles.button, styles.primaryBtn, isBusy ? styles.buttonDisabled : null]}
                disabled={isBusy}
              >
                <Text style={styles.primaryBtnText}>
                  {isBusy ? t("alerts.button.receiving") : t("alerts.button.received")}
                </Text>
              </Pressable>
              <Pressable onPress={() => void callSupport()} style={[styles.button, styles.secondaryBtn]}>
                <Text style={styles.secondaryBtnText}>{t("alerts.button.support")}</Text>
              </Pressable>
            </View>
          </Panel>
        );
      })}

      {recentHandled.length ? (
        <Panel
          title={t("alerts.section.recent")}
          subtitle={t("alerts.section.recentSubtitle")}
          centerHeaderText
          rightSlot={<MaterialCommunityIcons name="history" size={22} color={palette.sky700} />}
        >
          <View style={styles.recentList}>
            {recentHandled.map((alert) => (
              <View key={alert.id} style={styles.recentRow}>
                <MaterialCommunityIcons name="check-circle-outline" size={16} color={palette.good} />
                <Text style={styles.recentText}>
                  {deviceStatusService.getAlertPresentation(alert, language).title}
                </Text>
                <Text style={styles.recentTime}>{timeAgo(alert.updatedAt, language)}</Text>
              </View>
            ))}
          </View>
        </Panel>
      ) : null}
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
  centerText: {
    color: palette.textSoft,
    fontFamily: fonts.body,
    textAlign: "center",
    lineHeight: 20,
  },
  alertHeaderRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  detectedText: {
    flex: 1,
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "right",
  },
  alertMessage: {
    marginTop: spacing.md,
    color: palette.text,
    fontFamily: fonts.bodySemi,
    lineHeight: 22,
  },
  noteBox: {
    marginTop: spacing.md,
    width: "100%",
    borderRadius: radius.md,
    backgroundColor: "#F5FAFD",
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  noteText: {
    flex: 1,
    color: palette.textSoft,
    fontFamily: fonts.body,
    lineHeight: 19,
  },
  noteLabel: {
    color: palette.text,
    fontFamily: fonts.bodyBold,
  },
  actions: {
    marginTop: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  button: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  singleButton: {
    marginTop: spacing.md,
    minWidth: 180,
    flex: 0,
  },
  primaryBtn: {
    backgroundColor: palette.sky700,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  secondaryBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.line,
  },
  secondaryBtnText: {
    color: palette.text,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  recentList: {
    width: "100%",
    gap: spacing.sm,
  },
  recentRow: {
    width: "100%",
    borderRadius: radius.md,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recentText: {
    flex: 1,
    color: palette.text,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
  },
  recentTime: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
});

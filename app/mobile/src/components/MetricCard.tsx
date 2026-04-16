import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";
import { fonts, palette, radius, spacing } from "../theme";

type Tone = "sky" | "good" | "warn" | "danger" | "neutral";

type MetricCardProps = {
  icon: string;
  title: string;
  value: string;
  helper?: string;
  unit?: string;
  tone?: Tone;
  valueStyle?: StyleProp<TextStyle>;
};

const toneMap: Record<Tone, { iconBg: string; iconColor: string; border: string }> = {
  sky: { iconBg: "#E9F8FF", iconColor: palette.sky700, border: "#D4ECF8" },
  good: { iconBg: "#EFFAF4", iconColor: palette.good, border: "#D9F0E3" },
  warn: { iconBg: "#FFF6E8", iconColor: palette.warn, border: "#F6E1B9" },
  danger: { iconBg: "#FFF0F0", iconColor: palette.danger, border: "#F1D0D0" },
  neutral: { iconBg: palette.cardSoft, iconColor: palette.textSoft, border: palette.line },
};

export const MetricCard = ({ icon, title, value, helper, unit, tone = "sky", valueStyle }: MetricCardProps) => {
  const activeTone = toneMap[tone];

  return (
    <View style={[styles.card, { borderColor: activeTone.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: activeTone.iconBg }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={activeTone.iconColor} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, valueStyle]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
        {value}
        {unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 132,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: palette.card,
    padding: spacing.md,
    gap: 8,
    alignItems: "center",
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: palette.textSoft,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  value: {
    color: palette.text,
    fontFamily: fonts.title,
    fontSize: 26,
    lineHeight: 30,
    textAlign: "center",
  },
  unit: {
    color: palette.textSoft,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
  },
  helper: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
});

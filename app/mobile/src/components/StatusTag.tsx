import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, palette, radius, spacing } from "../theme";
import { SystemLevel } from "../types/aerogen";

type StatusTagProps = {
  level: SystemLevel;
  text: string;
};

const colorByLevel: Record<SystemLevel, { color: string; background: string }> = {
  ok: { color: palette.good, background: "#EFFAF4" },
  warn: { color: palette.warn, background: "#FFF7E7" },
  stop: { color: palette.danger, background: "#FFF0F0" },
};

export const StatusTag = ({ level, text }: StatusTagProps) => (
  <View style={[styles.wrap, { borderColor: colorByLevel[level].color, backgroundColor: colorByLevel[level].background }]}>
    <View style={[styles.dot, { backgroundColor: colorByLevel[level].color }]} />
    <Text style={[styles.text, { color: colorByLevel[level].color }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 99,
  },
  text: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    textAlign: "center",
  },
});

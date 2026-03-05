import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, palette, radius, spacing } from "../theme";
import { SystemLevel } from "../types/aerogen";

type StatusTagProps = {
  level: SystemLevel;
  text: string;
};

const colorByLevel: Record<SystemLevel, string> = {
  ok: palette.good,
  warn: palette.warn,
  stop: palette.danger,
};

export const StatusTag = ({ level, text }: StatusTagProps) => (
  <View style={[styles.wrap, { borderColor: colorByLevel[level] }]}>
    <View style={[styles.dot, { backgroundColor: colorByLevel[level] }]} />
    <Text style={[styles.text, { color: colorByLevel[level] }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
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

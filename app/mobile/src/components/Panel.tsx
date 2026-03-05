import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { fonts, palette, radius, shadows, spacing } from "../theme";

type PanelProps = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  style?: ViewStyle;
  children: React.ReactNode;
};

export const Panel = ({ title, subtitle, rightSlot, style, children }: PanelProps) => (
  <View style={[styles.card, style]}>
    <View style={styles.header}>
      {rightSlot ? <View style={styles.iconWrap}>{rightSlot}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
    <View style={styles.content}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.lg + 2,
    ...shadows.card,
  },
  header: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  iconWrap: {
    marginBottom: 4,
  },
  title: {
    color: palette.text,
    fontSize: 16,
    fontFamily: fonts.titleMedium,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 2,
    color: palette.textSoft,
    fontSize: 12,
    fontFamily: fonts.body,
    textAlign: "center",
  },
  content: {
    marginTop: spacing.md,
    alignItems: "center",
  },
});

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
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightSlot}
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
    padding: spacing.lg,
    ...shadows.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: {
    color: palette.text,
    fontSize: 16,
    fontFamily: fonts.titleMedium,
  },
  subtitle: {
    marginTop: 2,
    color: palette.textSoft,
    fontSize: 12,
    fontFamily: fonts.body,
  },
  content: {
    marginTop: spacing.md,
  },
});

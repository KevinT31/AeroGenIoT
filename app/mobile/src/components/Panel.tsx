import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { fonts, palette, radius, shadows, spacing } from "../theme";

type PanelProps = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  style?: ViewStyle;
  children: React.ReactNode;
  align?: "left" | "center";
  tone?: "default" | "soft";
  centerHeaderText?: boolean;
};

export const Panel = ({
  title,
  subtitle,
  rightSlot,
  style,
  children,
  align = "left",
  tone = "default",
  centerHeaderText = false,
}: PanelProps) => (
  <View style={[styles.card, tone === "soft" ? styles.cardSoft : null, style]}>
    <View
      style={[
        styles.header,
        align === "center" ? styles.headerCenter : null,
        centerHeaderText ? styles.headerTextCentered : null,
      ]}
    >
      {centerHeaderText ? <View style={styles.iconSpacer} /> : null}
      <View style={styles.headerCopy}>
        <Text style={[styles.title, align === "center" || centerHeaderText ? styles.centerText : null]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, align === "center" || centerHeaderText ? styles.centerText : null]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightSlot ? <View style={styles.iconWrap}>{rightSlot}</View> : centerHeaderText ? <View style={styles.iconSpacer} /> : null}
    </View>
    <View style={[styles.content, align === "center" ? styles.contentCenter : null]}>{children}</View>
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
  cardSoft: {
    backgroundColor: palette.cardSoft,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerCenter: {
    flexDirection: "column-reverse",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextCentered: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.chipBg,
  },
  iconSpacer: {
    width: 38,
    height: 38,
  },
  title: {
    color: palette.text,
    fontSize: 16,
    fontFamily: fonts.titleMedium,
  },
  subtitle: {
    color: palette.textSoft,
    fontSize: 12,
    fontFamily: fonts.body,
    lineHeight: 18,
  },
  centerText: {
    textAlign: "center",
  },
  content: {
    marginTop: spacing.md,
    alignItems: "flex-start",
  },
  contentCenter: {
    alignItems: "center",
  },
});

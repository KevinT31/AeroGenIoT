import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { fonts, palette, radius, shadows, spacing } from "../theme";

type HeroBannerProps = {
  icon: string;
  title: string;
  subtitle?: string;
  colors: [string, string];
  children?: React.ReactNode;
};

export const HeroBanner = ({ icon, title, subtitle, colors, children }: HeroBannerProps) => (
  <LinearGradient colors={colors} style={styles.hero}>
    <View style={styles.heroHeader}>
      <View style={styles.heroIconSpacer} />
      <Text style={styles.heroTitle}>{title}</Text>
      <View style={styles.heroIconWrap}>
        <MaterialCommunityIcons name={icon as any} size={24} color="#FFFFFF" />
      </View>
    </View>
    {subtitle ? <Text style={styles.heroSub}>{subtitle}</Text> : null}
    {children ? <View style={styles.heroFooter}>{children}</View> : null}
  </LinearGradient>
);

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    gap: spacing.sm,
    ...shadows.card,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.20)",
  },
  heroIconSpacer: {
    width: 44,
    height: 44,
  },
  heroTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: fonts.title,
    fontSize: 23,
    textAlign: "center",
  },
  heroSub: {
    color: "#EAF7FF",
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  heroFooter: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
});

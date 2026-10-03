import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, palette, radius, spacing } from "../theme";
import { useAero } from "../state/AeroContext";

type ScreenLayoutProps = {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export const ScreenLayout = ({ children, refreshing = false, onRefresh }: ScreenLayoutProps) => {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const refreshControl =
    onRefresh !== undefined ? (
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.sky700} />
    ) : undefined;
  const { syncState, usingCachedSnapshot, lastError } = useAero();
  const showNotice = usingCachedSnapshot || syncState === "stale" || syncState === "offline" || syncState === "error";
  const noticeText = usingCachedSnapshot
    ? "Mostrando ultimo estado guardado. Se actualizara cuando vuelva la conexion."
    : syncState === "stale"
      ? "Datos atrasados. La app sigue intentando actualizar."
      : syncState === "offline"
        ? "Sin telemetria reciente. Revisa conexion o backend."
        : "No se pudo sincronizar. Desliza para reintentar.";

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + tabBarHeight + insets.bottom }]}
        refreshControl={refreshControl}
      >
        {showNotice ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{noticeText}</Text>
            {lastError ? <Text style={styles.noticeDetail}>{lastError}</Text> : null}
          </View>
        ) : null}
        {children}
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
  notice: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#F1D8A6",
    backgroundColor: "#FFF8EA",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noticeText: {
    color: palette.amber700,
    fontFamily: fonts.bodySemi,
    lineHeight: 19,
    textAlign: "center",
  },
  noticeDetail: {
    marginTop: 3,
    color: palette.textSoft,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
});

import React from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { palette, spacing } from "../theme";

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

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + tabBarHeight + insets.bottom }]}
        refreshControl={refreshControl}
      >
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
});

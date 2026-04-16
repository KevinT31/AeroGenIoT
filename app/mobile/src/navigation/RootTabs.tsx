import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeScreen } from "../screens/HomeScreen";
import { AlertsScreen } from "../screens/AlertsScreen";
import { ProductionScreen } from "../screens/ProductionScreen";
import { TechnicalScreen } from "../screens/TechnicalScreen";
import { fonts, palette, radius, shadows } from "../theme";
import { useI18n } from "../i18n/LanguageContext";

const Tabs = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.background,
    card: palette.card,
    text: palette.text,
    border: palette.line,
    primary: palette.sky700,
  },
};

export const RootTabs = () => {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <NavigationContainer theme={navTheme}>
      <Tabs.Navigator
        initialRouteName="home"
        screenOptions={({ route }) => ({
          headerShown: false,
          sceneStyle: { backgroundColor: palette.background },
          tabBarActiveTintColor: palette.sky700,
          tabBarInactiveTintColor: palette.textSoft,
          tabBarStyle: {
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 12,
            height: 62 + insets.bottom,
            paddingBottom: Math.max(10, insets.bottom),
            paddingTop: 8,
            backgroundColor: "rgba(255,255,255,0.96)",
            borderTopWidth: 0,
            borderRadius: radius.lg,
            ...shadows.card,
          },
          tabBarLabelStyle: {
            fontFamily: fonts.bodySemi,
            fontSize: 12,
          },
          tabBarIcon: ({ color, size }) => {
            const nameByRoute: Record<string, string> = {
              home: "home-variant-outline",
              alerts: "bell-alert-outline",
              production: "chart-bar",
              technical: "compass-rose",
            };
            return <MaterialCommunityIcons name={nameByRoute[route.name] as any} size={size + 1} color={color} />;
          },
        })}
      >
        <Tabs.Screen name="home" component={HomeScreen} options={{ title: t("tab.home") }} />
        <Tabs.Screen name="alerts" component={AlertsScreen} options={{ title: t("tab.alerts") }} />
        <Tabs.Screen name="production" component={ProductionScreen} options={{ title: t("tab.production") }} />
        <Tabs.Screen name="technical" component={TechnicalScreen} options={{ title: t("tab.technical") }} />
      </Tabs.Navigator>
    </NavigationContainer>
  );
};

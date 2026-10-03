import React, { useRef } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeScreen } from "../screens/HomeScreen";
import { AlertsScreen } from "../screens/AlertsScreen";
import { ProductionScreen } from "../screens/ProductionScreen";
import { AiScreen } from "../screens/AiScreen";
import { TechnicalScreen } from "../screens/TechnicalScreen";
import { AccountScreen } from "../screens/AccountScreen";
import { fonts, palette, radius, shadows } from "../theme";
import { useI18n } from "../i18n/LanguageContext";
import { analyticsService } from "../services/analyticsService";

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
  const routeNameRef = useRef<string | undefined>(undefined);

  return (
    <NavigationContainer
      theme={navTheme}
      onReady={() => {
        void analyticsService.track({ event: "app_ready", category: "session" });
      }}
      onStateChange={(state) => {
        const route = state?.routes[state.index || 0];
        const currentName = route?.name;
        if (currentName && routeNameRef.current !== currentName) {
          routeNameRef.current = currentName;
          void analyticsService.track({ event: "screen_view", category: "screen", payload: { screen: currentName } });
        }
      }}
    >
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
            fontSize: 10.5,
            lineHeight: 13,
          },
          tabBarItemStyle: {
            minWidth: 48,
          },
          tabBarIcon: ({ color, size }) => {
            const nameByRoute: Record<string, string> = {
              home: "home-variant-outline",
              production: "chart-bar",
              alerts: "bell-alert-outline",
              ai: "brain",
              technical: "compass-rose",
              account: "account-circle-outline",
            };
            return <MaterialCommunityIcons name={nameByRoute[route.name] as any} size={size + 1} color={color} />;
          },
        })}
      >
        <Tabs.Screen name="home" component={HomeScreen} options={{ title: t("tab.home") }} />
        <Tabs.Screen name="production" component={ProductionScreen} options={{ title: t("tab.production") }} />
        <Tabs.Screen name="alerts" component={AlertsScreen} options={{ title: t("tab.alerts") }} />
        <Tabs.Screen name="ai" component={AiScreen} options={{ title: t("tab.ai") }} />
        <Tabs.Screen name="technical" component={TechnicalScreen} options={{ title: t("tab.technical") }} />
        <Tabs.Screen name="account" component={AccountScreen} options={{ title: "Cuenta" }} />
      </Tabs.Navigator>
    </NavigationContainer>
  );
};

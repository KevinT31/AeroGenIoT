import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeScreen } from "../screens/HomeScreen";
import { AlertsScreen } from "../screens/AlertsScreen";
import { ProductionScreen } from "../screens/ProductionScreen";
import { TechnicalScreen } from "../screens/TechnicalScreen";
import { fonts, palette } from "../theme";

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

  return (
    <NavigationContainer theme={navTheme}>
      <Tabs.Navigator
        initialRouteName="Inicio"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: palette.sky700,
          tabBarInactiveTintColor: palette.textSoft,
          tabBarStyle: {
            backgroundColor: palette.card,
            borderTopColor: palette.line,
            borderTopWidth: 1,
            height: 58 + insets.bottom + 8,
            paddingBottom: Math.max(8, insets.bottom),
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontFamily: fonts.bodySemi,
            fontSize: 12,
          },
          tabBarIcon: ({ color, size }) => {
            const nameByRoute: Record<string, string> = {
              Inicio: "home-variant-outline",
              Alertas: "bell-alert-outline",
              Produccion: "chart-bar",
              Tecnico: "wrench-cog-outline",
            };
            return <MaterialCommunityIcons name={nameByRoute[route.name] as any} size={size + 1} color={color} />;
          },
        })}
      >
        <Tabs.Screen name="Inicio" component={HomeScreen} />
        <Tabs.Screen name="Alertas" component={AlertsScreen} />
        <Tabs.Screen name="Produccion" component={ProductionScreen} />
        <Tabs.Screen name="Tecnico" component={TechnicalScreen} options={{ title: "Detalles" }} />
      </Tabs.Navigator>
    </NavigationContainer>
  );
};

import "react-native-gesture-handler";
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold, useFonts as useSpaceGrotesk } from "@expo-google-fonts/space-grotesk";
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, useFonts as useManrope } from "@expo-google-fonts/manrope";
import * as NavigationBar from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AeroProvider } from "./src/state/AeroContext";
import { LanguageProvider } from "./src/i18n/LanguageContext";
import { AuthScreen } from "./src/screens/AuthScreen";
import { RootTabs } from "./src/navigation/RootTabs";
import { analyticsService } from "./src/services/analyticsService";
import { SessionProvider, useSession } from "./src/state/SessionContext";
import { palette } from "./src/theme";

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    void analyticsService.captureError(error, { area: "react_boundary" });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: palette.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 }}>
          <Text style={{ color: palette.text, fontFamily: "SpaceGrotesk_700Bold", fontSize: 20, textAlign: "center" }}>
            La app necesita reiniciar esta vista
          </Text>
          <Text style={{ color: palette.textSoft, fontFamily: "Manrope_400Regular", textAlign: "center", lineHeight: 20 }}>
            Guardamos el error para diagnostico. Tus datos locales se mantienen.
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false })}
            style={{ backgroundColor: palette.sky700, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12 }}
          >
            <Text style={{ color: "#FFFFFF", fontFamily: "Manrope_700Bold" }}>Reintentar</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const AppGate = () => {
  const { isReady, isAuthenticated } = useSession();

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={palette.sky700} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <AeroProvider>
      <StatusBar style="light" />
      <RootTabs />
    </AeroProvider>
  );
};

export default function App() {
  const [spaceFontsLoaded] = useSpaceGrotesk({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  const [manropeFontsLoaded] = useManrope({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const applyAndroidNavigationBar = async () => {
      try {
        await NavigationBar.setBackgroundColorAsync(palette.background);
        await NavigationBar.setButtonStyleAsync("dark");
      } catch {
        // Ignore devices/ROMs that do not allow navigation bar style changes.
      }
    };
    void applyAndroidNavigationBar();
  }, []);

  if (!spaceFontsLoaded || !manropeFontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={palette.sky700} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <SessionProvider>
          <AppErrorBoundary>
            <AppGate />
          </AppErrorBoundary>
        </SessionProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

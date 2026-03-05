import "react-native-gesture-handler";
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold, useFonts as useSpaceGrotesk } from "@expo-google-fonts/space-grotesk";
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, useFonts as useManrope } from "@expo-google-fonts/manrope";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AeroProvider } from "./src/state/AeroContext";
import { RootTabs } from "./src/navigation/RootTabs";
import { palette } from "./src/theme";

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

  if (!spaceFontsLoaded || !manropeFontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={palette.sky700} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AeroProvider>
        <StatusBar style="light" />
        <RootTabs />
      </AeroProvider>
    </SafeAreaProvider>
  );
}

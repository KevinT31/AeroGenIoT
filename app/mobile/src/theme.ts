export const palette = {
  sky300: "#7DD3FC",
  sky500: "#38BDF8",
  sky700: "#0284C7",
  background: "#EEF5FA",
  card: "#FFFFFF",
  text: "#0F172A",
  textSoft: "#587188",
  line: "#D6E3EE",
  good: "#16A34A",
  warn: "#F59E0B",
  danger: "#DC2626",
  chipBg: "#E8F5FF",
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
};

export const shadows = {
  card: {
    shadowColor: "#0A1825",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
};

export const fonts = {
  title: "SpaceGrotesk_700Bold",
  titleMedium: "SpaceGrotesk_500Medium",
  body: "Manrope_400Regular",
  bodySemi: "Manrope_600SemiBold",
  bodyBold: "Manrope_700Bold",
} as const;

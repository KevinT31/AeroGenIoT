export const palette = {
  sky200: "#BAE7FF",
  sky300: "#7DD3FC",
  sky500: "#38BDF8",
  sky700: "#0284C7",
  sky900: "#0B4F71",
  teal500: "#14B8A6",
  teal700: "#0F766E",
  amber500: "#F59E0B",
  amber700: "#B45309",
  rose500: "#E35D6A",
  rose700: "#BE3144",
  background: "#ECF4F8",
  backgroundStrong: "#DCEBF2",
  card: "#FFFFFF",
  cardSoft: "#F7FBFE",
  text: "#0F172A",
  textSoft: "#5F7386",
  textMuted: "#8295A8",
  line: "#D6E3EE",
  lineStrong: "#BFD3E0",
  good: "#169C62",
  warn: "#E1A12E",
  danger: "#D84A4A",
  chipBg: "#E8F5FF",
  shadow: "#0A1825",
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 30,
};

export const shadows = {
  card: {
    shadowColor: palette.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  soft: {
    shadowColor: palette.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
};

export const fonts = {
  title: "SpaceGrotesk_700Bold",
  titleMedium: "SpaceGrotesk_500Medium",
  body: "Manrope_400Regular",
  bodySemi: "Manrope_600SemiBold",
  bodyBold: "Manrope_700Bold",
} as const;

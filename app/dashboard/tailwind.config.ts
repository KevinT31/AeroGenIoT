import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        noctua: {
          950: "#07111c",
          900: "#0b1524",
          850: "#101c2e",
          800: "#13243b",
          700: "#193758",
          600: "#1d4f7a",
          500: "#1977b9",
          400: "#28a4f2",
          300: "#6bc9ff",
          200: "#b8ebff",
        },
        aurora: {
          500: "#33d7c7",
          400: "#5af3d7",
          300: "#a0ffec",
        },
        signal: {
          ok: "#2bd47a",
          warn: "#f4b655",
          danger: "#ff6678",
          info: "#53b6ff",
          offline: "#7a8496",
        },
      },
      boxShadow: {
        panel: "0 22px 70px rgba(5, 9, 20, 0.18)",
        glow: "0 0 0 1px rgba(91, 201, 255, 0.16), 0 18px 40px rgba(13, 35, 56, 0.22)",
        twin: "0 0 40px rgba(83, 182, 255, 0.15)",
      },
      backgroundImage: {
        "grid-fine":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        "grid-soft":
          "radial-gradient(circle at top, rgba(83,182,255,0.15), transparent 40%), radial-gradient(circle at bottom right, rgba(51,215,199,0.14), transparent 30%)",
      },
      fontFamily: {
        display: ["Outfit", "sans-serif"],
        body: ["IBM Plex Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.45", transform: "scale(1)" },
          "50%": { opacity: "0.9", transform: "scale(1.06)" },
        },
        floatY: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "pulse-glow": "pulseGlow 2.8s ease-in-out infinite",
        float: "floatY 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;

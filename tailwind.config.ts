import type { Config } from "tailwindcss";

// Design system: HL dark green, palest variant — the whole surface stack
// lifted so it reads green rather than black, calm mint accent, no neon.
// Participation palette aqua/blue/yellow/magenta validated on this surface.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sora)", "Sora", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      colors: {
        // Surfaces — HL dark green, palest step of the stack
        // (named `page`, not `base`, so text-base keeps its font-size meaning)
        page: "#0e1c15",
        surface: {
          DEFAULT: "#16281f", // cards
          2: "#1d3327", // nested blocks, inputs, hovers
          3: "#254031", // active
        },
        edge: {
          DEFAULT: "#2e4d3a", // card borders
          soft: "#243c2e", // inner separators
          strong: "#446a52",
        },
        ink: {
          DEFAULT: "#edf6f1", // primary text — soft mint-white
          2: "#b0c8ba", // secondary
          3: "#86a494", // muted
        },
        // Brand / accent — calm HL mint (dark text on filled controls)
        accent: {
          DEFAULT: "#3ecf8e",
          dim: "#173f2a",
        },
        // Semantics — trading
        buy: { DEFAULT: "#3ecf8e", dim: "#173f2a" },
        sell: { DEFAULT: "#e66767", dim: "#3d1e1e" },
        warn: { DEFAULT: "#fab219", dim: "#3d2f12" },
        // Chart series (validated dark steps; participation order s3→s1→s2→s5)
        s1: "#3987e5", // MM — blue
        s2: "#c98500", // TWAP — yellow
        s3: "#199e70", // organic — aqua
        s4: "#d95926", // spare — orange
        s5: "#d55181", // vol bot — magenta
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.3)",
      },
      keyframes: {
        blink: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        flash: {
          "0%": { backgroundColor: "rgba(62,207,142,0.14)" },
          "100%": { backgroundColor: "transparent" },
        },
        "flash-red": {
          "0%": { backgroundColor: "rgba(230,103,103,0.14)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        blink: "blink 2s ease-in-out infinite",
        flash: "flash 0.6s ease-out",
        "flash-red": "flash-red 0.6s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        bg: {
          DEFAULT: "#0a110e",
          panel: "#111a16",
          raised: "#16221d",
          line: "#26352e",
        },
        term: {
          green: "#3bffa6",
          dim: "#1aa873",
          bright: "#7dffc1",
          amber: "#ffc451",
          red: "#ff6172",
          blue: "#5fc8ff",
          violet: "#b98bff",
          muted: "#9fb3aa",
          text: "#e2efe9",
        },
      },
      boxShadow: {
        glow: "0 0 12px rgba(34,229,143,0.25)",
        "glow-red": "0 0 12px rgba(255,77,94,0.25)",
      },
      keyframes: {
        blink: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
        flash: {
          "0%": { backgroundColor: "rgba(34,229,143,0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
        "flash-red": {
          "0%": { backgroundColor: "rgba(255,77,94,0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        blink: "blink 1.2s steps(2,start) infinite",
        flash: "flash 0.6s ease-out",
        "flash-red": "flash-red 0.6s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;

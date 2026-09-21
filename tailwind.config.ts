import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: "#030508",
          900: "#070a11",
          850: "#0c101c",
          800: "#131828",
          750: "#182034",
          700: "#1e273f",
          600: "#2a3758",
          500: "#44557f",
          400: "#6478a8",
          300: "#93a3cb",
          200: "#c7d2e8",
          100: "#e9edf7",
        },
        gold: {
          DEFAULT: "#f59e0b",
          light: "#fbbf24",
          soft: "#fef3c7",
          glow: "rgba(245, 158, 11, 0.35)",
        },
        cyan: {
          DEFAULT: "#06b6d4",
          light: "#38bdf8",
          glow: "rgba(6, 182, 212, 0.35)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2.5s infinite linear",
        "float": "float 6s ease-in-out infinite",
        "glow-ping": "glowPing 3s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        glowPing: {
          "75%, 100%": { transform: "scale(2)", opacity: "0" },
        },
      },
      boxShadow: {
        "glass-subtle": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "glass-elevated": "0 20px 50px 0 rgba(0, 0, 0, 0.6)",
        "glow-amber": "0 0 35px -5px rgba(245, 158, 11, 0.3)",
        "glow-cyan": "0 0 35px -5px rgba(6, 182, 212, 0.3)",
        "inner-light": "inset 0 1px 0 0 rgba(255, 255, 255, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;

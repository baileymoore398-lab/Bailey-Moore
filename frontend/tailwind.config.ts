import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Orienteering palette: warm forest-dark base + course-magenta accent
        // (the IOF course/control overprint colour), contour-brown and
        // vegetation-green secondaries.
        bg: {
          DEFAULT: "#0c0e0a",
          soft: "#11140d",
          card: "#171b12",
          elevated: "#1f2418",
        },
        border: "#2c3322",
        accent: {
          DEFAULT: "#2ecf6e",
          hot: "#c6692f",
          lime: "#86d94f",
        },
        muted: "#9aa089",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        shimmer: "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;

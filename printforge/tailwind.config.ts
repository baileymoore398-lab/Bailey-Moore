import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef9ff",
          100: "#d9f0ff",
          200: "#bae4ff",
          300: "#8ad3ff",
          400: "#52b8ff",
          500: "#2a97ff",
          600: "#1376f5",
          700: "#0f5ee1",
          800: "#134db6",
          900: "#15438f",
          950: "#122a57"
        },
        forge: {
          500: "#ff7a18",
          600: "#f25c05"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;

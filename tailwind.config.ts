import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(214.3 31.8% 91.4%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222.2 84% 4.9%)",
        primary: {
          DEFAULT: "hsl(222.2 47.4% 11.2%)",
          foreground: "hsl(210 40% 98%)",
        },
        brand: {
          50: "#f0f7ff",
          500: "#0284c7",
          600: "#0369a1",
          700: "#075985",
          900: "#082f49",
        },
        status: {
          success: "#059669",
          warning: "#d97706",
          danger: "#dc2626",
          info: "#2563eb",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

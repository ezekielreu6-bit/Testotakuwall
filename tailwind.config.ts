// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        otaku: {
          red: '#ef4444',
          zinc: '#1c1c1e',
          dark: '#050505',
          black: '#000000',
        }
      },
      fontFamily: {
        sans: ["var(--font-jakarta)"],
      },
    },
  },
  plugins: [],
};
export default config;
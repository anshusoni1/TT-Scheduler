import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Overriding slate with our warm, elegant, editorial palette
        slate: {
          50: '#FFFFFF',  // White
          100: '#F8F3EA', // NxtBell Background
          200: '#EADCC8', // NxtBell Surface (cards)
          300: '#D8C3A5',
          400: '#9C8F82', // NxtBell Secondary text
          500: '#73726E',
          600: '#5A5956',
          700: '#403F3C',
          800: '#2A2927',
          900: '#1F1F1F', // NxtBell Text
          950: '#141312', // Dark mode background
        },
        // Adding the restrained coral-red accent
        coral: {
          50: '#FDF3F1',
          100: '#FBE4DF',
          200: '#F5C4B9',
          300: '#ED9B8A',
          400: '#FFA68C', // NxtBell ACCENT
          500: '#FF7A5F', // NxtBell PRIMARY
          600: '#E85A4F',
          700: '#A73222',
          800: '#8A2D1F',
          900: '#732A1F',
          950: '#3F130D',
        }
      },
    },
  },
  plugins: [],
};
export default config;

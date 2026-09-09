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
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Overriding slate with our warm, elegant, editorial palette
        slate: {
          50: '#FBFBF9', // eggshell / warm off-white
          100: '#F5F5F0', // dark vanilla
          200: '#E8E6DF', // taupe / muted gray
          300: '#D6D3C8',
          400: '#AFA999',
          500: '#8A8370',
          600: '#645E4D',
          700: '#4A4538',
          800: '#332F26',
          900: '#2D2C2A', // warm charcoal
          950: '#1A1918',
        },
        // Adding the restrained coral-red accent
        coral: {
          50: '#FDF3F1',
          100: '#FBE4DF',
          200: '#F5C4B9',
          300: '#ED9B8A',
          400: '#E46750',
          500: '#E05C48', // restrained jelly-bean / coral-red
          600: '#C7412E',
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

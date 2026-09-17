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
          50: '#FDFCF8',  // Off-white / Card background in light mode
          100: '#EAE7DC', // PRIMARY BACKGROUND / EGGSHELL (Light mode bg)
          200: '#D8C3A5', // SECONDARY SURFACES / WARM BEIGE (Accents / borders)
          300: '#C7B194',
          400: '#8E8D8A', // BORDER / MUTED DETAIL / TAUPE
          500: '#73726E',
          600: '#5A5956',
          700: '#403F3C',
          800: '#2A2927', // TEXT / CONTRAST
          900: '#1D1C1A', // Dark mode surfaces
          950: '#141312', // Dark mode background
        },
        // Adding the restrained coral-red accent
        coral: {
          50: '#FDF3F1',
          100: '#FBE4DF',
          200: '#F5C4B9',
          300: '#ED9B8A',
          400: '#E98074', // PRIMARY ACCENT
          500: '#E85A4F', // STRONG ACTION / RED
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

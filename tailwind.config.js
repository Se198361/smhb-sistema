/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#25E6F7', // neon cyan
        accent: '#8AFF5A',  // neon lime
        danger: '#FF3B7F',  // neon magenta
        warning: '#FFD166', // warm neon amber
        light: '#E8F7FF',
        muted: '#0F1D2B',
        dark: '#071722',
        darkMuted: '#0A2335',
        panel: '#0C2B43',
      },
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'],
        roboto: ['Roboto', 'sans-serif'],
        mono: ['Space Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
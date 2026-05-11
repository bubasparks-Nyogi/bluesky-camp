import type { Config } from 'tailwindcss'
const config: Config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx,mdx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          50:  '#fdf8f0',
          100: '#f9eed8',
          200: '#f0c080',
          300: '#d4845a',
          400: '#a05a30',
          500: '#7c4a1e',
          600: '#5a3010',
          700: '#3d2010',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif JP"', 'serif'],
        sans:  ['"Noto Sans JP"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config

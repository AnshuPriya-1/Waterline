/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'aws-blue': '#0071ce',
        'aws-blue-dark': '#0058a3',
        'aws-blue-light': '#ebf5fc',
        'track-water': '#d97706',
        'track-water-light': '#fef3c7',
        'track-water-dark': '#92400e',
        'status-green': '#15803d',
        'status-green-light': '#dcfce7',
        'wmd-bg': '#fcfbf9',
        'wmd-card': '#ffffff',
        'wmd-border': '#e5e7eb',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

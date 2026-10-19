/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          bg: '#14121a',
          card: '#1c1a22',
          elevated: '#24212c',
          border: '#2d2a37',
          accent: '#ff6a3d',
          accentGlow: 'rgba(255, 106, 61, 0.25)',
        },
        status: {
          running: '#22c55e',
          waiting: '#f97316',
          idle: '#71717a',
          error: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', '"Courier New"', 'monospace'],
      },
      boxShadow: {
        'card': '0 14px 36px -6px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'accent-glow': '0 0 24px -2px rgba(255, 106, 61, 0.35), 0 0 0 1px rgba(255, 106, 61, 0.45)',
      }
    },
  },
  plugins: [],
};

import type { Config } from 'tailwindcss';

// Playly design tokens. Source of truth = public/legacy/styles.css :root + theme
// overrides. Keep this synced with legacy palette when those values change.
//
// Three themes co-exist:
//   - User dark (default)         → body (no data-theme)
//   - User light                  → body[data-theme="light"]
//   - Admin                       → body[data-role="admin"]  (dark only, flat)
//
// Phase 2: only brand-literal colors exposed (no CSS var refs yet). When the
// first themed component lands, add `bg`/`text`/`primary` tokens that read
// CSS vars from globals.css so utilities follow the active theme.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // User dark — wine + cream (default Playly identity)
        wine: {
          DEFAULT: '#6D2932',
          hover: '#8c3a45',
          deep: '#561C24',
        },
        cream: {
          DEFAULT: '#E8D8C4',
          soft: '#C7B7A3',
          muted: '#806a5e',
        },
        // Page surfaces — user dark
        ink: {
          DEFAULT: '#1a0c10', // bg
          elev: '#251419',    // card surface
          'elev-2': '#311c22',
        },
        // User light — deep wine on warm cream
        'wine-light': {
          DEFAULT: '#842A3B',
          hover: '#662222',
          deep: '#4A1818',
          muted: '#A3485A',
        },
        sand: {
          DEFAULT: '#F5E8C9', // light bg
          elev: '#FAEAC7',
          'elev-2': '#FCE9C0',
          accent: '#F5DAA7',
        },
        // Admin — navy/slate (flat, no FX)
        slate: {
          bg: '#212529',
          elev: '#343A40',
          'elev-2': '#495057',
          deep: '#1C283C',
          accent: '#ADB5BD',
          khaki: '#DCD3A9',
        },
        // Status (shared across themes)
        status: {
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
        },
      },
      borderRadius: {
        sm: '10px',
        DEFAULT: '16px',
        lg: '22px',
      },
      boxShadow: {
        'playly-sm': '0 1px 2px rgba(0,0,0,.35), 0 4px 12px rgba(0,0,0,.28)',
        'playly-md': '0 4px 12px rgba(0,0,0,.34), 0 16px 40px rgba(0,0,0,.30)',
        'playly-lg': '0 12px 32px rgba(0,0,0,.46), 0 32px 80px rgba(0,0,0,.40)',
      },
      transitionTimingFunction: {
        playly: 'cubic-bezier(.4, 0, .2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;

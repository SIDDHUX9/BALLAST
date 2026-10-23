import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: 'var(--bg-paper)',
          raised: 'var(--bg-paper-raised)',
          surface: 'var(--bg-surface)',
        },
        ink: {
          DEFAULT: 'var(--text-ink)',
          soft: 'var(--text-ink-soft)',
          muted: 'var(--text-muted)',
        },
        hairline: {
          DEFAULT: 'var(--border-hairline)',
          strong: 'var(--border-strong)',
        },
        safe: {
          DEFAULT: 'var(--color-safe)',
          bg: 'var(--color-safe-bg)',
        },
        watch: {
          DEFAULT: 'var(--color-watch)',
          bg: 'var(--color-watch-bg)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          bg: 'var(--color-danger-bg)',
        },
        ember: {
          DEFAULT: 'var(--color-ember)',
          soft: 'var(--color-ember-soft)',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Fraunces', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Instrument Sans', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
        hand: ['var(--font-handwritten)', 'Caveat', 'cursive'],
      },
      maxWidth: {
        container: '1200px',
      },
      borderRadius: {
        DEFAULT: '3px',
        sm: '2px',
        md: '4px',
        none: '0',
      },
      boxShadow: {
        elevation: '0 4px 16px -2px var(--shadow-color)',
        none: 'none',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;

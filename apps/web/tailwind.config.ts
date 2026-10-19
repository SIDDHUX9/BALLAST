import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        mezo: {
          dark: '#0c0e12',
          card: '#161922',
          border: '#262b3a',
          accent: '#f7931a', // Bitcoin orange
          cyan: '#00e5ff',
        },
      },
    },
  },
  plugins: [],
};

export default config;

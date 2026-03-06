import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2D8CF0',
          light: '#5BA8F5',
          dark: '#1A6FC4',
        },
        secondary: '#0D1B2A',
        accent: '#42B4F5',
        background: '#0F1923',
        surface: {
          DEFAULT: '#162433',
          elevated: '#1C2E42',
        },
        'text-primary': '#E8F1FA',
        'text-secondary': '#8BA3BC',
        border: '#253545',
        error: '#EF4444',
        warning: '#F59E0B',
        success: '#22C55E',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ["'Inter'", "'Segoe UI'", "'Roboto'", 'sans-serif'],
      },
      fontSize: {
        xs: ['0.8rem', { lineHeight: '1.2rem' }],
        sm: ['0.9rem', { lineHeight: '1.35rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.25rem', { lineHeight: '1.875rem' }],
        xl: ['1.5625rem', { lineHeight: '2.1rem' }],
        '2xl': ['1.953rem', { lineHeight: '2.5rem' }],
        '3xl': ['2.441rem', { lineHeight: '3rem' }],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        lg: '14px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.3)',
        DEFAULT: '0 4px 8px rgba(0,0,0,0.35)',
        lg: '0 10px 20px rgba(0,0,0,0.4)',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
        '16': '64px',
      },
    },
  },
  plugins: [],
};

export default config;

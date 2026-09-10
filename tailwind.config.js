/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      xs: '400px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
    extend: {
      colors: {
        // Deep green branding
        forest: {
          50: '#f0f7f2',
          100: '#dcecdf',
          200: '#bbd9c2',
          300: '#8fbf9c',
          400: '#5c9d70',
          500: '#3a7f51',
          600: '#2a6640',
          700: '#1f4d31', // primary deep green
          800: '#173a26',
          900: '#0f2619',
        },
        // Lime accent
        lime: {
          50: '#f7fee7',
          100: '#ecfccb',
          200: '#d9f99d',
          300: '#bef264',
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
        },
        // Warm white / sand backgrounds
        sand: {
          50: '#fbfaf6',
          100: '#f5f2e9',
          200: '#eae4d3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 38, 25, 0.06), 0 1px 2px rgba(15, 38, 25, 0.04)',
        raised: '0 4px 16px rgba(15, 38, 25, 0.10)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
};

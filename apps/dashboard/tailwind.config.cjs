module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Archivo"', 'system-ui', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#F7F7F9',
          100: '#EDEEF2',
          200: '#D2D6E0',
          300: '#AEB6C6',
          400: '#7E889F',
          500: '#5A647C',
          600: '#3D465B',
          700: '#2C3344',
          800: '#1C2130',
          900: '#0E111A',
        },
        electric: {
          500: '#3AE6B6',
          600: '#25C99A',
        },
        sunset: {
          500: '#FF8A3D',
        },
      },
      boxShadow: {
        panel: '0 24px 40px rgba(12, 16, 28, 0.18)',
      },
      backgroundImage: {
        'dashboard-gradient':
          'radial-gradient(circle at top left, rgba(58, 230, 182, 0.25), transparent 45%), radial-gradient(circle at bottom right, rgba(255, 138, 61, 0.2), transparent 40%)',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Cores customizadas usando variáveis CSS
        'accent': 'var(--accent-color)',
        'bg-primary': 'var(--bg-primary)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        // Cores da landing lpautonhealth
        'auton-blue': {
          dark: '#1a365d',
          primary: '#1e3a5f',
          medium: '#2c3e50',
        },
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)', opacity: '0.25' },
          '50%': { transform: 'translateY(-10px)', opacity: '0.35' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

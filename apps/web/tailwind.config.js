/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm cream/amber theme - Light Mode
        primary: {
          50: '#FFF9F0',
          100: '#FFF2D7',
          200: '#FFE0B5',
          300: '#F8C794',
          400: '#D8AE7E',
          500: '#C49A6C',
          600: '#A07D54',
          700: '#7D6142',
          800: '#5A4530',
          900: '#3D2E1F',
        },
        accent: {
          50: '#FEF7E7',
          100: '#FDECC8',
          200: '#FBDBA3',
          300: '#F9C97E',
          400: '#F7B759',
          500: '#E69A35',
          600: '#C47D24',
          700: '#A26118',
          800: '#7F4A10',
          900: '#5C350A',
        },
        cream: {
          50: '#FFFDF9',
          100: '#FFF9F0',
          200: '#FFF2D7',
          300: '#FFE0B5',
          400: '#F8C794',
          500: '#D8AE7E',
        },
        // Dark mode - Black Matte Theme
        dark: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#262626',
          800: '#171717',
          900: '#0a0a0a',
          950: '#000000',
        },
      },
      backgroundImage: {
        'gradient-warm': 'linear-gradient(135deg, #FFF2D7 0%, #FFE0B5 50%, #F8C794 100%)',
        'gradient-warm-dark': 'linear-gradient(135deg, #171717 0%, #0a0a0a 50%, #000000 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #D8AE7E 0%, #F8C794 100%)',
        'gradient-sidebar-dark': 'linear-gradient(180deg, #262626 0%, #171717 100%)',
      },
    },
  },
  plugins: [],
}

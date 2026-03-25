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
        course: {
          managing: '#8B1A1A',
          philosophy: '#1A3B5C',
          marketing: '#2D6A4F',
          accounting: '#7B2D8B',
        },
        urgency: {
          urgent: '#DC2626',
          upcoming: '#F59E0B',
          info: '#3B82F6',
        }
      }
    },
  },
  plugins: [],
}

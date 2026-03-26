/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tennis: {
          green: '#E8002D',   // TV Bruvi Rot (Primärfarbe)
          light: '#FF6B8A',   // Helles Rot für Text auf dunklem BG
          dark:  '#1A3B8F',   // TV Bruvi Navy-Blau
          yellow:'#FFD700',   // Akzent Gold
          navy:  '#1A3B8F',   // Alias für Navy
          red:   '#E8002D',   // Alias für Rot
        }
      }
    }
  },
  plugins: []
}

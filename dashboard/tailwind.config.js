/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta oficial (Sección 9 de proyecto.md)
        nfl: {
          navy: '#013369',
          red: '#D50A0A',
          white: '#FFFFFF',
        },
        board: {
          DEFAULT: '#0F172A', // fondo pizarra
          panel: '#1E293B', // tarjetas
        },
        turf: {
          dark: '#1B5E20', // solo cancha
          light: '#2E7D32',
        },
      },
    },
  },
  plugins: [],
}

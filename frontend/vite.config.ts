import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist', // Output directory
    minify: 'terser', // Minify files using Terser
    sourcemap: false // Do not Generate source maps
  },
})

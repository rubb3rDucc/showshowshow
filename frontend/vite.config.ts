import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist', // Output directory
    minify: 'terser', // Minify files using Terser
    sourcemap: false // Do not Generate source maps
  },
  test: {
    // Pure-logic unit tests only (no DOM) — keep them fast and non-brittle.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

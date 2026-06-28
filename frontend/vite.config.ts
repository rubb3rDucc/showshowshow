import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // FRONTEND_PORT lets multiple worktrees run their dev servers side by side.
  // Defaults to Vite's usual 5173 when unset.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      port: Number(env.FRONTEND_PORT) || 5173,
    },
    build: {
      outDir: 'dist', // Output directory
      minify: 'terser', // Minify files using Terser
      sourcemap: false // Do not Generate source maps
    },
  }
})

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    define: {
      // Astro used PUBLIC_* env vars; keep them working in Vite.
      'import.meta.env.PUBLIC_API_URL': JSON.stringify(env.PUBLIC_API_URL ?? ''),
      'import.meta.env.USE_PRODUCTION_DATA': JSON.stringify(env.USE_PRODUCTION_DATA ?? ''),
    },
  }
})

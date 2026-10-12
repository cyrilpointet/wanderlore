import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  /**
   * Same set-up as the player front: the session cookie and the CSRF token
   * only work when the app and the API share an origin, so in development
   * Vite is that origin and forwards the API to the backend. Its own port,
   * so both apps run side by side.
   */
  const backend = env.BACKEND_URL ?? 'http://localhost:3333'

  return {
    plugins: [
      // Must run before the React plugin: it generates the route tree the app imports.
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: { '@': new URL('./src', import.meta.url).pathname },
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': { target: backend, changeOrigin: true },
      },
    },
  }
})

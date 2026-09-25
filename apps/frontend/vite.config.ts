import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  /**
   * The backend authenticates by session cookie and checks a CSRF token read
   * from a cookie: both only work when the front and the API share an origin.
   * In development, Vite is that origin and forwards the API and the SSE
   * channel to the backend.
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
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/__transmit': { target: backend, changeOrigin: true },
      },
    },
  }
})

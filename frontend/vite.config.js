import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // "" prefix = saari .env values padho — API_KEY par VITE_ nahi, isliye browser tak nahi jaati
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // browser /api/... ko call karta hai (same origin, CORS nahi) — Vite aage backend ko bhejta hai
        '/api': {
          target: 'http://localhost:4000',
          rewrite: (path) => path.replace(/^\/api/, ''),
          // API key yahin (Node mein) lagti hai — frontend code mein kabhi nahi
          headers: { 'x-api-key': env.API_KEY },
        },
      },
    },
  }
})

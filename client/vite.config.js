import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const layout = env.VITE_LAYOUT || 'store1'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@layout': path.resolve(__dirname, `src/layouts/${layout}`),
      },
    },
    server: {
      proxy: {
        '/api': 'http://localhost:3000',
        '/uploads': 'http://localhost:3000',
      },
    },
  }
})

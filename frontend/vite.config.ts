import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    server: {
      port: 5174,
      open: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true
        }
      }
    },
    define: {
      'process.env.enableRagas': JSON.stringify(env.enableRagas),
      'process.env.enableDeepEval': JSON.stringify(env.enableDeepEval)
    }
  }
})

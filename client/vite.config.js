import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  optimizeDeps: {
    include: [],
    noDiscovery: true
  },
  build: {
    // Evita alertas de chunk grande em builds; mantemos limite mais alto para o bundle atual
    chunkSizeWarningLimit: 1024
  }
})

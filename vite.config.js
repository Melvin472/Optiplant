import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // On crée un raccourci : quand le code appelle '/api-influx', 
      // Vite le redirige vers le vrai serveur InfluxDB
      '/api-influx': {
        target: 'https://eu-central-1-1.aws.cloud2.influxdata.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-influx/, ''),
      },
    },
  },
})
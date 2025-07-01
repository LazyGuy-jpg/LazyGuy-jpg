import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/login': 'http://localhost:3000',
      '/register': 'http://localhost:3000',
      '/logout': 'http://localhost:3000',
      '/user': 'http://localhost:3000',
      '/admin': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
      '/v2': 'http://localhost:3000',
      '/payment-currencies': 'http://localhost:3000',
      '/create-payment': 'http://localhost:3000',
      '/nowpayments-ipn': 'http://localhost:3000',
    }
  },
})

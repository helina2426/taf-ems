// Settings for Vite, the tool that runs the React app during development
// and builds it for production.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // fail clearly if 5173 is busy, instead of silently using another port
    // During development, any request to /api is passed on to the backend.
    // So the React code can simply call "/api/health" — no full address needed.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});

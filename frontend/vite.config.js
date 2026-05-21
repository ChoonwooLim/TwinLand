import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cache-Control — 전역 CLAUDE.md 규칙
const noCacheHeaders = { 'Cache-Control': 'public, max-age=0, must-revalidate' };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    headers: noCacheHeaders,
    proxy: {
      '/api': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
  preview: {
    port: 5173,
    headers: noCacheHeaders,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/](react|react-dom|react-router-dom|react-router|scheduler)[\\/]/.test(id)) return 'react-vendor';
          if (/[\\/](three|@react-three)[\\/]/.test(id)) return 'three-vendor';
          if (/[\\/](leaflet|react-leaflet)[\\/]/.test(id)) return 'map-vendor';
          if (/[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/.test(id)) return 'i18n-vendor';
          if (/[\\/]framer-motion[\\/]/.test(id)) return 'motion-vendor';
          if (/[\\/]@mantine[\\/]/.test(id)) return 'mantine-vendor';
          if (/[\\/]@tabler[\\/]icons-react[\\/]/.test(id)) return 'icons-vendor';
          if (/[\\/]recharts[\\/]/.test(id)) return 'charts-vendor';
        },
      },
    },
  },
});

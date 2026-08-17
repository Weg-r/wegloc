import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4000,
    strictPort: true,
  },
  // Vite's dependency pre-bundler (esbuild) rewrites maplibre-gl's internal
  // `new Worker(new URL(...))` reference for its tile-parsing worker in a way
  // that breaks it -- the worker script request hangs at (pending) forever
  // and no tile ever gets parsed. Excluding it from pre-bundling serves it
  // as-is and keeps that worker URL intact.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
})

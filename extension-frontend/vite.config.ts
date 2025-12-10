// vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // Enables React (JSX/TSX support)
    react(),

    // Handles Chrome Extension (CRX) build with manifest.json
    crx({ manifest }),
  ],

  // Ensures static files (sidebar.html, welcome.html, etc.) in "public/"
  // are copied directly into dist/
  publicDir: 'public'
})

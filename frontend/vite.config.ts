import fs from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Chemin canonique du projet (casse exacte de Windows, ex. C:\ et non c:\).
// Racine et alias doivent utiliser la même casse : sinon Vite charge certains
// modules en double (React, i18next) et la page reste blanche.
const root = fs.realpathSync.native(process.cwd())

// https://vite.dev/config/
export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // Le monde 3D (three.js) est chargé à la demande sur /ville : gros paquet attendu
    chunkSizeWarningLimit: 1200,
  },
})

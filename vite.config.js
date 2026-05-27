import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  optimizeDeps: {
    // Evita que o Vite tente pré-empacotar os pacotes ffmpeg.wasm,
    // que usam Workers e WASM dinâmico incompatíveis com o pre-bundler
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core'],
  },
  // Cross-Origin Isolation é obrigatório para SharedArrayBuffer,
  // que por sua vez é exigido pelo @ffmpeg/ffmpeg v0.12+
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
})

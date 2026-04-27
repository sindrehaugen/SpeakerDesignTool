import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Vite + Tauri-aware config.
// - `base: './'` keeps `dist/index.html` openable via `file://` and works
//   under Tauri's custom `tauri://` protocol.
// - `clearScreen: false` lets Tauri's rustc output co-exist with Vite's.
// - `strictPort: true` and fixed HMR port mirror the Tauri v2 docs.
const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: 'ws', host, port: 5174 }
      : undefined,
    open: false,
    watch: {
      // Don't rebuild-loop on Rust file changes during `tauri dev`.
      ignored: ['**/src-tauri/**'],
    },
  },
  // Tauri supports modern browsers natively — target Edge WebView2 features.
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'es2022',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG || true,
  },
})

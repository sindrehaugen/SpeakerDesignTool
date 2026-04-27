import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { flush, hydrate } from './services/storage'
import './styles/main.css'

/**
 * Bootstrap sequence:
 *   1. Hydrate persistent storage (Tauri: read JSON files from %APPDATA%;
 *      browser: no-op — stores read from localStorage directly).
 *   2. Mount the Vue app. Pinia stores instantiate lazily on first `use*`,
 *      and their `read(key)` calls hit the now-populated cache.
 *   3. Install a `beforeunload` handler that flushes any debounced writes.
 */
async function boot(): Promise<void> {
  await hydrate()

  const app = createApp(App)
  app.use(createPinia())
  app.mount('#app')

  window.addEventListener('beforeunload', () => {
    // Fire-and-forget — `beforeunload` can't reliably await.
    void flush()
  })
}

void boot()

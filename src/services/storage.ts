/**
 * Persistent storage abstraction.
 *
 * Two backends, one synchronous-looking API so Pinia stores don't have to
 * change their reactive shape:
 *
 *  - **Tauri (desktop):** JSON files under `%APPDATA%\com.speakerdesigntool.app\`.
 *    Reads are primed into an in-memory cache during {@link hydrate} (awaited
 *    before the Vue app mounts). Writes update the cache synchronously and
 *    debounce a real disk write. Data survives WebView2 cache clears, is
 *    user-inspectable / backup-friendly, and migrates legacy `localStorage`
 *    contents on first boot.
 *
 *  - **Browser (dev / legacy):** straight pass-through to `localStorage`.
 *    `hydrate` is a no-op and `flush` resolves immediately.
 *
 * Storage keys are whatever the stores use today (`sdt_database_v4`,
 * `sdt_user_prefs_v4`, `sdt_room_v4`) — no rename needed.
 */

import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

/** Keys we manage on behalf of Pinia stores. Order matters for hydration logs. */
export const STORAGE_KEYS = [
  'sdt_database_v4',
  'sdt_user_prefs_v4',
  'sdt_room_v4',
  'sdt_subarray_v4',
] as const
export type StorageKey = (typeof STORAGE_KEYS)[number]

/** True when the page is running inside the Tauri webview. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// --------------------------------------------------------------------------
// Cache + debounce
// --------------------------------------------------------------------------

const cache = new Map<string, string>()
const pending = new Map<string, ReturnType<typeof setTimeout>>()
const inflight = new Set<Promise<void>>()

/** Delay before a pending write is actually committed to disk (ms). */
const WRITE_DEBOUNCE_MS = 250

function fileNameFor(key: string): string {
  return `${key}.json`
}

async function ensureAppDir(): Promise<void> {
  // Idempotent — `mkdir` with `recursive: true` never throws on existing dirs.
  await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true })
}

async function writeNow(key: string, value: string): Promise<void> {
  await ensureAppDir()
  await writeTextFile(fileNameFor(key), value, { baseDir: BaseDirectory.AppData })
}

/** Schedule a debounced disk write for the given key. */
function scheduleWrite(key: string, value: string): void {
  const existing = pending.get(key)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(() => {
    pending.delete(key)
    const p = writeNow(key, value).catch((e) => {
      console.warn(`[storage] write failed for ${key}:`, e)
    })
    inflight.add(p)
    void p.finally(() => inflight.delete(p))
  }, WRITE_DEBOUNCE_MS)

  pending.set(key, timer)
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Prime the in-memory cache from disk (or from legacy localStorage on first
 * boot). MUST be awaited before any Pinia store is instantiated — stores read
 * from the cache synchronously during setup.
 */
export async function hydrate(): Promise<void> {
  if (!isTauri()) return // browser: reads hit localStorage directly

  for (const key of STORAGE_KEYS) {
    const file = fileNameFor(key)
    try {
      const has = await exists(file, { baseDir: BaseDirectory.AppData })
      if (has) {
        const text = await readTextFile(file, { baseDir: BaseDirectory.AppData })
        cache.set(key, text)
        continue
      }
    } catch (e) {
      console.warn(`[storage] read failed for ${key}:`, e)
    }

    // No file — check if a legacy localStorage entry exists from a previous
    // browser session and migrate it.
    try {
      const legacy = window.localStorage?.getItem(key)
      if (legacy) {
        cache.set(key, legacy)
        await writeNow(key, legacy)
        console.info(`[storage] migrated ${key} from localStorage to disk`)
      }
    } catch {
      /* no localStorage available — first-ever boot, nothing to migrate */
    }
  }
}

/** Synchronous read. In Tauri, reads from the hydrated cache; otherwise localStorage. */
export function read(key: StorageKey | string): string | null {
  if (isTauri()) return cache.get(key) ?? null
  try {
    return window.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

/** Synchronous write. In Tauri, updates cache + debounces a disk write; otherwise localStorage. */
export function write(key: StorageKey | string, value: string): void {
  if (isTauri()) {
    cache.set(key, value)
    scheduleWrite(key, value)
    return
  }
  try {
    window.localStorage?.setItem(key, value)
  } catch (e) {
    console.warn(`[storage] localStorage write failed for ${key}:`, e)
  }
}

/**
 * Await any in-flight or pending disk writes. Useful from a `beforeunload`
 * handler so the last debounced batch flushes before the window closes.
 * No-op in browser mode.
 */
export async function flush(): Promise<void> {
  if (!isTauri()) return
  // Fire any pending debounced writes immediately.
  for (const [key, timer] of pending) {
    clearTimeout(timer)
    pending.delete(key)
    const value = cache.get(key)
    if (value !== undefined) {
      const p = writeNow(key, value).catch((e) => {
        console.warn(`[storage] flush write failed for ${key}:`, e)
      })
      inflight.add(p)
      void p.finally(() => inflight.delete(p))
    }
  }
  // Wait for all currently in-flight writes to complete.
  await Promise.allSettled([...inflight])
}

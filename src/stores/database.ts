import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { EquipmentDatabase, Speaker, Cable, Amplifier, EquipmentType } from '@/types/domain'
import { DEFAULT_DATABASE } from '@/data/defaultDatabase'
import { read, write } from '@/services/storage'

const STORAGE_KEY = 'sdt_database_v4'

function loadFromStorage(): EquipmentDatabase {
  try {
    const raw = read(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as EquipmentDatabase
  } catch (e) {
    console.warn('DB load error:', e)
  }
  return structuredClone(DEFAULT_DATABASE)
}

/** Equipment library: speakers, cables, amplifiers.
 *  Auto-persists through the storage abstraction — localStorage in the
 *  browser, JSON file under %APPDATA% when running under Tauri.
 */
export const useDatabaseStore = defineStore('database', () => {
  const data = ref<EquipmentDatabase>(loadFromStorage())

  watch(
    data,
    (v) => {
      try { write(STORAGE_KEY, JSON.stringify(v)) }
      catch (e) { console.warn('DB save error:', e) }
    },
    { deep: true },
  )

  function upsert(type: EquipmentType, item: Speaker | Cable | Amplifier): void {
    ;(data.value[type] as Record<string, Speaker | Cable | Amplifier>)[item.id] = item
  }

  function remove(type: EquipmentType, id: string): void {
    const bucket = data.value[type] as Record<string, unknown>
    delete bucket[id]
  }

  function replaceAll(next: EquipmentDatabase): void {
    data.value = next
  }

  function merge(next: Partial<EquipmentDatabase>): void {
    if (next.speakers) Object.assign(data.value.speakers, next.speakers)
    if (next.cables) Object.assign(data.value.cables, next.cables)
    if (next.amplifiers) Object.assign(data.value.amplifiers, next.amplifiers)
  }

  function resetToDefaults(): void {
    data.value = structuredClone(DEFAULT_DATABASE)
  }

  function brandsFor(type: EquipmentType): string[] {
    const bucket = data.value[type] as Record<string, { brand?: string }>
    const brands = new Set<string>()
    for (const item of Object.values(bucket)) if (item.brand) brands.add(item.brand)
    return [...brands].sort()
  }

  return { data, upsert, remove, replaceAll, merge, resetToDefaults, brandsFor }
})

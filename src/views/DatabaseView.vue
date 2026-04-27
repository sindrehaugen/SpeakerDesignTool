<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDatabaseStore } from '@/stores/database'
import type { EquipmentType, Speaker, Cable, Amplifier } from '@/types/domain'
import {
  csvToSpeakers, csvToCables, csvToAmplifiers,
  exportDatabaseCsv, generateItemId,
} from '@/services/io'

const database = useDatabaseStore()

const currentType = ref<EquipmentType>('speakers')
const search = ref('')
const editingId = ref<string | null>(null)
const editBuffer = ref<Record<string, unknown>>({})

const typeTabs: Array<{ v: EquipmentType; label: string }> = [
  { v: 'speakers', label: 'Speakers' },
  { v: 'cables',   label: 'Cables' },
  { v: 'amplifiers', label: 'Amplifiers' },
]

const items = computed(() => {
  const bucket = database.data[currentType.value] as Record<string, { brand?: string; model?: string }>
  const list = Object.values(bucket)
  const q = search.value.toLowerCase()
  return q
    ? list.filter((x) => `${x.brand} ${x.model}`.toLowerCase().includes(q))
    : list
})

function getField(item: unknown, key: string): unknown {
  return (item as Record<string, unknown>)[key]
}

function edit(item: { id: string }): void {
  editingId.value = item.id
  editBuffer.value = { ...item }
}

function saveEdit(): void {
  if (!editingId.value) return
  const id = generateItemId(
    String(editBuffer.value['brand'] ?? ''),
    String(editBuffer.value['model'] ?? ''),
  )
  if (id !== editingId.value) database.remove(currentType.value, editingId.value)
  const next = { ...editBuffer.value, id } as Speaker | Cable | Amplifier
  database.upsert(currentType.value, next)
  editingId.value = null
}

function addNew(): void {
  const id = `New ${Date.now()}`
  const base = { id, brand: 'Unknown', model: 'Model' }
  if (currentType.value === 'speakers') {
    database.upsert('speakers', { ...base, impedance: 8, wattage_rms: 50, type: 'Low-Z' } as Speaker)
  } else if (currentType.value === 'cables') {
    database.upsert('cables', { ...base, crossSection: 2.5, resistance: 7.4 } as Cable)
  } else {
    database.upsert('amplifiers', { ...base, watt_8: 100, channels_lowz: 2, min_load: 4 } as Amplifier)
  }
  edit({ id })
}

function onImport(ev: Event): void {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result)
    let items: Array<Speaker | Cable | Amplifier> = []
    if (currentType.value === 'speakers') items = csvToSpeakers(text)
    else if (currentType.value === 'cables') items = csvToCables(text)
    else items = csvToAmplifiers(text)
    for (const it of items) database.upsert(currentType.value, it)
    alert(`Imported ${items.length} item(s).`)
  }
  reader.readAsText(file)
  input.value = ''
}

const columns = computed(() => {
  if (currentType.value === 'speakers') return ['brand', 'model', 'impedance', 'wattage_rms', 'sensitivity', 'type']
  if (currentType.value === 'cables') return ['brand', 'model', 'crossSection', 'resistance', 'capacitance', 'inductance']
  return ['brand', 'model', 'watt_8', 'watt_4', 'watt_100v', 'min_load']
})
</script>

<template>
  <div class="database">
    <header class="toolbar">
      <nav class="type-tabs">
        <button
          v-for="t in typeTabs" :key="t.v"
          :class="['tab', { active: currentType === t.v }]"
          @click="currentType = t.v"
        >{{ t.label }}</button>
      </nav>
      <input v-model="search" placeholder="Search…" class="search" />
      <button @click="addNew">+ New</button>
      <label class="file-btn">
        <input type="file" accept=".csv" hidden @change="onImport" />
        Import CSV
      </label>
      <button @click="exportDatabaseCsv(currentType, database.data)">Export CSV</button>
      <button class="ghost" @click="database.resetToDefaults">Reset</button>
    </header>

    <div class="panel">
      <table class="table">
        <thead>
          <tr>
            <th v-for="c in columns" :key="c">{{ c }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="String(getField(item, 'id'))">
            <td v-for="c in columns" :key="c">{{ getField(item, c) ?? '-' }}</td>
            <td>
              <button class="ghost icon" @click="edit({ id: String(getField(item, 'id')) })">Edit</button>
              <button class="ghost icon" @click="database.remove(currentType, String(getField(item, 'id')))">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="editingId" class="modal-backdrop" @click.self="editingId = null">
      <div class="modal">
        <h2>Edit {{ currentType.slice(0, -1) }}</h2>
        <div class="fields">
          <label v-for="c in columns" :key="c">
            {{ c }}
            <input v-model="editBuffer[c]" />
          </label>
        </div>
        <footer>
          <button class="ghost" @click="editingId = null">Cancel</button>
          <button class="primary" @click="saveEdit">Save</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.database { display: flex; flex-direction: column; gap: 12px; }
.toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.type-tabs { display: flex; gap: 2px; margin-right: 16px; }
.type-tabs .tab {
  background: transparent; color: var(--fg-dim); border: 1px solid transparent;
}
.type-tabs .tab.active { background: var(--bg-2); color: var(--fg); border-color: var(--border); }
.search { flex: 1; min-width: 200px; max-width: 400px; }
.panel { overflow: auto; max-height: calc(100vh - 200px); }
.file-btn {
  display: inline-flex; align-items: center; padding: 6px 12px;
  border: 1px solid var(--border); background: var(--bg-1);
  border-radius: var(--radius-sm); cursor: pointer; font-size: 14px;
}
.file-btn:hover { background: var(--bg-2); }
.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }
.fields label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>

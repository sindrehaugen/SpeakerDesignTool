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
.database {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  height: calc(100vh - 38px);
}

/* Top utility bar — segmented type selector + search + actions */
.toolbar {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  padding: 6px 8px;
  height: 38px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.type-tabs {
  display: flex;
  gap: 0;
  margin-right: 8px;
  padding: 2px;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
}
.type-tabs .tab {
  background: transparent;
  color: var(--fg-dim);
  border: 1px solid transparent;
  padding: 0 12px;
  height: 22px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  box-shadow: none;
}
.type-tabs .tab:hover { color: var(--fg); background: var(--bg-2); }
.type-tabs .tab.active {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent-line);
}

.search {
  flex: 1;
  min-width: 200px;
  max-width: 360px;
  font-family: var(--font-mono);
  font-size: 12px;
}
.search::placeholder { color: var(--fg-subtle); text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; }

.file-btn {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%);
  color: var(--fg);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  box-shadow: var(--shadow-1);
}
.file-btn:hover { background: var(--bg-3); border-color: var(--border-strong); }

/* Equipment ledger */
.panel {
  flex: 1;
  overflow: auto;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-1);
}
.panel :deep(.table) { font-size: 11px; }
.panel :deep(.table th) {
  text-transform: uppercase;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.10em;
  color: var(--accent);
  border-bottom: 1px solid var(--border);
  background: var(--bg-1);
  height: 26px;
}
.panel :deep(.table td) {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  padding: 3px 8px;
  height: 24px;
  border-bottom: 1px solid var(--border-soft);
}
.panel :deep(.table tbody tr:nth-child(odd)) { background: rgba(255,255,255,0.012); }
.panel :deep(.table tbody tr:hover) { background: var(--accent-soft); }

/* Edit modal — denser fields */
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 10px 0;
}
.fields label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border-soft);
}
</style>

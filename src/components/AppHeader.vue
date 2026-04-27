<script setup lang="ts">
import { useUiStore, type ViewName } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'
import { downloadFile } from '@/services/io'
import { generatePdfReport } from '@/services/report'

const ui = useUiStore()
const project = useProjectStore()

const tabs: Array<{ id: ViewName; label: string }> = [
  { id: 'calculator', label: 'Calculator' },
  { id: 'database',   label: 'Database' },
  { id: 'room',       label: 'Room & Coverage' },
  { id: 'calculators',label: 'Acoustics' },
  { id: 'subarray',   label: 'Sub-Array' },
  { id: 'reports',    label: 'Reports' },
  { id: 'reference',  label: 'Reference' },
]

function loadProject(ev: Event): void {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result))
      project.loadProjectJson(data)
    } catch (e) {
      alert('Invalid project file: ' + (e as Error).message)
    }
  }
  reader.readAsText(file)
  input.value = ''
}

async function runReport(): Promise<void> {
  try {
    const db = project.serialize(true) as unknown as { database: unknown }
    await generatePdfReport({
      project: project.projectInfo,
      report: project.reportInfo,
      mode: project.mode,
      db: (db as { database: import('@/types/domain').EquipmentDatabase }).database,
      ampRack: project.ampRack,
      roots: project.activeRoots,
      analysis: project.analysis,
    })
  } catch (e) {
    alert('Report failed: ' + (e as Error).message)
  }
}

function quickSave(): void {
  downloadFile(
    `${project.projectInfo.name}.sdt.json`,
    JSON.stringify(project.serialize(true), null, 2),
    'application/json',
  )
}
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <strong>Speaker Design Tool</strong>
      <span class="muted mono">v3</span>
    </div>

    <nav class="tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        :class="['tab', { active: ui.currentView === t.id }]"
        @click="ui.currentView = t.id"
      >{{ t.label }}</button>
    </nav>

    <div class="actions">
      <label class="file-btn">
        <input type="file" accept=".json,.sdt.json" hidden @change="loadProject" />
        Load
      </label>
      <button @click="quickSave">Save</button>
      <button @click="ui.showSaveModal = true">Save As…</button>
      <button class="primary" @click="runReport">PDF Report</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
}
.brand { display: flex; align-items: baseline; gap: 8px; }
.tabs { display: flex; gap: 2px; flex: 1; }
.tab {
  background: transparent;
  border: 1px solid transparent;
  color: var(--fg-dim);
  padding: 6px 14px;
}
.tab:hover { color: var(--fg); background: var(--bg-2); }
.tab.active { color: var(--fg); background: var(--bg-2); border-color: var(--border); }
.actions { display: flex; gap: 6px; align-items: center; }
.file-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border: 1px solid var(--border);
  background: var(--bg-1);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
}
.file-btn:hover { background: var(--bg-2); }
</style>

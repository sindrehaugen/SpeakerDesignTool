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
      <span class="logo-dot" aria-hidden="true"></span>
      <strong class="brand-name">SPEAKER<span class="brand-sep">·</span>DESIGN</strong>
      <span class="brand-ver mono">v3.0</span>
    </div>

    <nav class="tabs" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.id"
        role="tab"
        :aria-selected="ui.currentView === t.id"
        :class="['tab', { active: ui.currentView === t.id }]"
        @click="ui.currentView = t.id"
      >{{ t.label }}</button>
    </nav>

    <div class="actions">
      <label class="file-btn" title="Load project">
        <input type="file" accept=".json,.sdt.json" hidden @change="loadProject" />
        Load
      </label>
      <button @click="quickSave" title="Quick save">Save</button>
      <button @click="ui.showSaveModal = true" title="Save as…">Save As…</button>
      <span class="sep" aria-hidden="true"></span>
      <button class="primary" @click="runReport" title="Generate PDF report">PDF Report</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 38px;
  padding: 0 10px;
  background: linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 0 rgba(0,0,0,0.4);
  user-select: none;
  -webkit-user-select: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 10px;
  border-right: 1px solid var(--border-soft);
  height: 100%;
}
.logo-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent-line), 0 0 12px var(--accent-soft);
}
.brand-name {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--fg);
}
.brand-sep { color: var(--accent); margin: 0 1px; }
.brand-ver {
  font-size: 10px;
  color: var(--fg-subtle);
  letter-spacing: 0.04em;
}

.tabs {
  display: flex;
  gap: 0;
  flex: 1;
  height: 100%;
  align-items: stretch;
  overflow: hidden;
}
.tab {
  background: transparent;
  border: 0;
  border-radius: 0;
  border-bottom: 2px solid transparent;
  color: var(--fg-dim);
  padding: 0 12px;
  height: 100%;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  box-shadow: none;
  transition: color 80ms linear, border-color 80ms linear, background 80ms linear;
}
.tab:hover { color: var(--fg); background: rgba(255,255,255,0.02); }
.tab.active {
  color: var(--accent);
  background: linear-gradient(180deg, rgba(34,211,238,0.04) 0%, transparent 100%);
  border-bottom-color: var(--accent);
}

.actions {
  display: flex;
  gap: 4px;
  align-items: center;
  padding-left: 8px;
  border-left: 1px solid var(--border-soft);
  height: 100%;
}
.actions button { height: 24px; }
.sep { width: 1px; height: 18px; background: var(--border-soft); margin: 0 4px; }
.file-btn {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%);
  color: var(--fg);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  box-shadow: var(--shadow-1);
  transition: background 80ms linear, border-color 80ms linear;
}
.file-btn:hover { background: var(--bg-3); border-color: var(--border-strong); }
</style>

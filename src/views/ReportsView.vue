<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '@/stores/project'
import { useDatabaseStore } from '@/stores/database'
import { generatePdfReport } from '@/services/report'
import { exportToXls } from '@/services/io'

const project = useProjectStore()
const database = useDatabaseStore()

const rows = computed(() => {
  const out: Array<Array<string | number>> = []
  let n = 1
  const walk = (nodes: import('@/types/domain').SignalNode[]): void => {
    for (const node of nodes) {
      const r = project.analysis.get(node.id)?.results ?? node.results
      const spk = database.data.speakers[node.speakerId]
      const cab = database.data.cables[node.cableId]
      out.push([
        node.id,
        node.userLabel,
        `S-${n++} · ${spk?.brand ?? ''} ${spk?.model ?? node.speakerId}`,
        `${cab?.brand ?? ''} ${cab?.model ?? node.cableId} (${node.length} m)`,
        r.minLoad?.toFixed(2) ?? '-',
        `${r.dropPercent?.toFixed(2) ?? '-'}%`,
        `${r.hfLossDb?.toFixed(2) ?? '-'} dB`,
        r.status,
      ])
      walk(node.children)
    }
  }
  walk(project.activeRoots)
  return out
})

async function makePdf(): Promise<void> {
  await generatePdfReport({
    project: project.projectInfo,
    report: project.reportInfo,
    mode: project.mode,
    db: database.data,
    ampRack: project.ampRack,
    roots: project.activeRoots,
    analysis: project.analysis,
  })
}

function makeXls(): void {
  exportToXls(project.projectInfo, {
    Overview: [
      ['Project', project.projectInfo.name],
      ['Company', project.reportInfo.company],
      ['Designer', project.reportInfo.designer],
      ['Mode', project.mode],
      ['Quality', project.qualityMode],
      [],
      ['ID', 'Label', 'Speaker', 'Cable', 'Load Ω', 'Drop %', 'HF loss', 'Status'],
      ...rows.value,
    ],
  })
}
</script>

<template>
  <div class="reports">
    <div class="card meta">
      <h3>Report metadata</h3>
      <div class="grid">
        <label>Company
          <input v-model="project.reportInfo.company" />
        </label>
        <label>Designer
          <input v-model="project.reportInfo.designer" />
        </label>
        <label>Logo URL
          <input v-model="project.reportInfo.logoUrl" placeholder="data:image/png;base64,…" />
        </label>
      </div>
    </div>

    <div class="actions">
      <button class="primary" @click="makePdf">Download PDF</button>
      <button @click="makeXls">Download .xls</button>
    </div>

    <div class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th><th>Label</th><th>Speaker</th><th>Cable</th>
            <th>Load Ω</th><th>Drop %</th><th>HF loss</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i">
            <td v-for="(cell, j) in r" :key="j">{{ cell }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="8" class="muted">No data — build a signal chain first.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.reports {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.meta {
  padding: 10px 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-1);
}
.meta :deep(h3) {
  margin: 0 0 8px 0;
  color: var(--fg);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-soft);
}
.meta .grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 4px;
}
.meta label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
}
.meta input { font-family: var(--font-mono); font-size: 12px; text-align: left; }

/* Action bar — export controls */
.actions {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 6px 10px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  height: 38px;
}
.actions::before {
  content: "EXPORT";
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.10em;
  color: var(--fg-subtle);
  margin-right: 8px;
  padding-right: 8px;
  border-right: 1px solid var(--border-soft);
}

/* Bill-of-materials ledger */
.panel {
  overflow: auto;
  max-height: calc(100vh - 220px);
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-1);
}
.panel :deep(.table) { font-size: 11px; }
.panel :deep(.table th) {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  color: var(--accent);
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  height: 26px;
}
.panel :deep(.table td) {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  padding: 3px 10px;
  height: 24px;
  border-bottom: 1px solid var(--border-soft);
}
.panel :deep(.table tbody tr:nth-child(odd)) { background: rgba(255,255,255,0.012); }
.panel :deep(.table tbody tr:hover) { background: var(--accent-soft); }
.panel :deep(.table td.muted),
.panel :deep(.table td:has(.muted)) {
  text-align: center;
  font-style: italic;
  color: var(--fg-subtle);
  padding: 24px;
}
</style>

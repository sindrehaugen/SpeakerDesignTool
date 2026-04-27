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
.reports { display: flex; flex-direction: column; gap: 16px; }
.meta .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
.meta label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
.actions { display: flex; gap: 8px; }
</style>

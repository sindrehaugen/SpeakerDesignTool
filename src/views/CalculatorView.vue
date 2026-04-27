<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '@/stores/project'
import type { SystemMode, QualityMode } from '@/types/domain'
import TreeNode from '@/components/tree/TreeNode.vue'
import ImpedanceChart from '@/components/charts/ImpedanceChart.vue'

const project = useProjectStore()

const modes: Array<{ v: SystemMode; label: string }> = [
  { v: 'low-z',  label: 'Low-Z (4/8 Ω)' },
  { v: 'high-v', label: '100V / 70V' },
]

const qualities: Array<{ v: QualityMode; label: string }> = [
  { v: 'high-end', label: 'High-End (5%)' },
  { v: 'average',  label: 'Average (10%)' },
  { v: 'speech',   label: 'Speech (15%)' },
]

const selectedNodeId = ref<string | null>(null)
const selectedBranch = computed(() => {
  const id = selectedNodeId.value ?? project.activeRoots[0]?.id
  if (!id) return null
  return project.analysis.get(id)?.branch ?? null
})

const summary = computed(() => {
  let ok = 0, warn = 0, err = 0
  for (const { results } of project.analysis.values()) {
    if (results.status === 'OK') ok++
    else if (results.status === 'Warning') warn++
    else if (results.status === 'Error') err++
  }
  return { ok, warn, err, total: project.analysis.size }
})
</script>

<template>
  <div class="calculator">
    <aside class="controls card">
      <h3>System</h3>
      <label>Project name
        <input v-model="project.projectInfo.name" />
      </label>
      <label>Mode
        <select v-model="project.mode">
          <option v-for="m in modes" :key="m.v" :value="m.v">{{ m.label }}</option>
        </select>
      </label>
      <label>Quality target
        <select v-model="project.qualityMode">
          <option v-for="q in qualities" :key="q.v" :value="q.v">{{ q.label }}</option>
        </select>
      </label>
      <label>Temperature (°C)
        <input type="number" v-model.number="project.settings.temp_c" />
      </label>

      <div class="summary">
        <span class="badge ok">OK {{ summary.ok }}</span>
        <span class="badge warning">⚠ {{ summary.warn }}</span>
        <span class="badge error">✕ {{ summary.err }}</span>
      </div>

      <button class="primary" @click="project.addRoot">+ Add root branch</button>
      <button class="ghost" @click="project.clearProject">Clear project</button>
    </aside>

    <section class="tree panel">
      <header class="panel-head">
        <h2>Signal chain</h2>
        <span class="muted mono">{{ project.activeRoots.length }} root(s) · {{ project.allNodes.length }} node(s)</span>
      </header>
      <div class="tree-scroll">
        <p v-if="!project.activeRoots.length" class="muted empty">
          No branches yet. Click "Add root branch" to start building your signal chain.
        </p>
        <div
          v-for="root in project.activeRoots"
          :key="root.id"
          class="root-wrap"
          @click="selectedNodeId = root.id"
        >
          <TreeNode :node="root" :depth="0" />
        </div>
      </div>
    </section>

    <aside class="charts">
      <div class="card">
        <h3>Impedance vs. frequency</h3>
        <ImpedanceChart :branch="selectedBranch" />
      </div>
    </aside>
  </div>
</template>

<style scoped>
.calculator {
  display: grid;
  grid-template-columns: 240px 1fr 400px;
  gap: 8px;
  padding: 8px;
  height: calc(100vh - 38px);
  background: var(--bg);
}

/* Left rail — system controls */
.controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.controls :deep(h3) {
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-soft);
  margin-bottom: 2px;
}
.controls label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
}
.controls label input,
.controls label select { font-size: 12px; }
.controls > button { margin-top: 2px; }

.summary {
  display: flex;
  gap: 4px;
  margin: 6px 0 2px;
  padding: 8px;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  flex-wrap: wrap;
}

/* Center — signal chain */
.tree {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  height: 32px;
  background: linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%);
  border-bottom: 1px solid var(--border);
}
.panel-head :deep(h2) {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg);
}
.tree-scroll {
  flex: 1;
  overflow: auto;
  padding: 8px;
  background:
    linear-gradient(var(--bg-1), var(--bg-1)),
    repeating-linear-gradient(0deg, transparent 0 23px, var(--border-soft) 23px 24px);
  background-blend-mode: normal;
}
.empty {
  text-align: center;
  padding: 48px 24px;
  color: var(--fg-subtle);
  font-size: 12px;
  letter-spacing: 0.02em;
}
.root-wrap {
  margin-bottom: 4px;
  border-left: 2px solid transparent;
  padding-left: 4px;
  transition: border-color 80ms linear;
}
.root-wrap:hover { border-left-color: var(--accent-line); }

/* Right rail — analysis charts */
.charts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
}
.charts .card {
  padding: 10px;
}
.charts :deep(h3) {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--fg-dim);
  padding-bottom: 6px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border-soft);
}
</style>

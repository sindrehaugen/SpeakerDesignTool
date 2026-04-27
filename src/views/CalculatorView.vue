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
  gap: 12px;
  height: calc(100vh - 80px);
}
.controls { display: flex; flex-direction: column; gap: 10px; }
.controls label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
.summary { display: flex; gap: 6px; margin: 8px 0; flex-wrap: wrap; }
.tree { display: flex; flex-direction: column; overflow: hidden; }
.panel-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid var(--border-soft);
}
.tree-scroll { flex: 1; overflow: auto; padding: 12px; }
.empty { text-align: center; padding: 40px; }
.root-wrap { margin-bottom: 8px; }
.charts { display: flex; flex-direction: column; gap: 12px; overflow: auto; }
</style>

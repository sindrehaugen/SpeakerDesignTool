<script setup lang="ts">
import { computed } from 'vue'
import type { SignalNode } from '@/types/domain'
import { useProjectStore } from '@/stores/project'
import { useDatabaseStore } from '@/stores/database'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{ node: SignalNode; depth: number }>()

const project = useProjectStore()
const database = useDatabaseStore()
const ui = useUiStore()

const analysis = computed(() => project.analysis.get(props.node.id))
const results = computed(() => analysis.value?.results ?? props.node.results)

const speakerList = computed(() => Object.values(database.data.speakers))
const cableList = computed(() => Object.values(database.data.cables))
const ampLabel = computed(() => {
  if (!props.node.ampInstanceId) return 'Select amp…'
  const inst = project.ampRack[props.node.ampInstanceId]
  if (!inst) return 'Select amp…'
  const model = database.data.amplifiers[inst.modelId]
  return `${inst.id} · ${model?.brand ?? ''} ${model?.model ?? inst.modelId}`
})

function openAmpModal(): void {
  ui.pendingAmpNode = props.node
  ui.showAmpModal = true
}

function openCableWizard(): void {
  ui.wizard.visible = true
  ui.wizard.candidates = []
  ui.wizard.targetNode = props.node
}

const statusClass = computed(() => {
  switch (results.value.status) {
    case 'OK':      return 'badge ok'
    case 'Warning': return 'badge warning'
    case 'Error':   return 'badge error'
    default:        return 'badge pending'
  }
})

const tapOptions = computed(() => {
  const spk = database.data.speakers[props.node.speakerId]
  return spk?.taps && spk.taps.length ? spk.taps : [1, 2, 5, 10, 20, 30, 50]
})
</script>

<template>
  <div class="tree-node" :style="{ marginLeft: depth * 24 + 'px' }">
    <div class="row">
      <span class="id mono">{{ node.id }}</span>
      <input v-model="node.userLabel" placeholder="label" class="label-input" />

      <template v-if="!node.parentId">
        <button class="amp-btn" @click="openAmpModal">{{ ampLabel }}</button>
      </template>

      <select v-model="node.speakerId">
        <option v-for="s in speakerList" :key="s.id" :value="s.id">
          {{ s.brand }} {{ s.model }}
        </option>
      </select>

      <label class="inline">
        ×<input type="number" min="1" v-model.number="node.parallelCount" class="num-sm" />
      </label>

      <template v-if="project.mode === 'high-v'">
        <select v-model.number="node.tapPower">
          <option v-for="t in tapOptions" :key="t" :value="t">{{ t }} W</option>
        </select>
      </template>

      <select v-model="node.cableId">
        <option v-for="c in cableList" :key="c.id" :value="c.id">
          {{ c.brand }} {{ c.model }}
        </option>
      </select>
      <label class="inline">
        L=<input type="number" min="0" v-model.number="node.length" class="num-sm" />m
      </label>

      <button class="ghost icon" title="Cable wizard" @click="openCableWizard">🪄</button>

      <span :class="statusClass">{{ results.status }}</span>

      <div class="metrics mono">
        <template v-if="project.mode === 'low-z'">
          <span>{{ results.minLoad?.toFixed(2) ?? '-' }} Ω</span>
        </template>
        <template v-else>
          <span>{{ results.totalPower ?? 0 }} W</span>
        </template>
        <span>▼{{ results.dropPercent?.toFixed(1) ?? '-' }}%</span>
        <span>HF{{ results.hfLossDb?.toFixed(2) ?? '-' }} dB</span>
        <span v-if="results.headroomPct !== undefined">H{{ Math.round(results.headroomPct) }}%</span>
      </div>

      <button class="ghost icon" title="Add child" @click="project.addChild(node.id)">＋</button>
      <button class="ghost icon" title="Remove" @click="project.removeNode(node.id)">✕</button>
    </div>

    <div v-if="results.statusMessage" class="status-message mono muted">
      {{ results.statusMessage }}
    </div>

    <TreeNode
      v-for="child in node.children"
      :key="child.id"
      :node="child"
      :depth="depth + 1"
    />
  </div>
</template>

<style scoped>
.tree-node { margin-bottom: 2px; }

/* Channel-strip row — each signal node */
.row {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 3px 6px 3px 4px;
  background: var(--bg-1);
  border: 1px solid var(--border-soft);
  border-left: 2px solid var(--border);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  flex-wrap: wrap;
  min-height: 26px;
  transition: border-left-color 80ms linear, background 80ms linear;
}
.row:hover {
  background: var(--bg-2);
  border-left-color: var(--accent);
}

/* Node ID — patchbay tag */
.id {
  color: var(--accent);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  min-width: 54px;
  padding: 1px 5px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-line);
  border-radius: 2px;
  text-align: center;
}

.label-input {
  width: 100px;
  height: 22px;
  padding: 0 6px;
  font-size: 11px;
  background: var(--bg);
}
.label-input::placeholder {
  color: var(--fg-subtle);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.row select,
.row input {
  height: 22px;
  font-size: 11px;
  padding: 0 6px;
  background: var(--bg);
}

/* Amplifier assignment button */
.amp-btn {
  height: 22px;
  padding: 0 8px;
  background: linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%);
  border: 1px solid var(--border);
  color: var(--fg);
  font-size: 11px;
  font-family: var(--font-mono);
}
.amp-btn:hover { border-color: var(--accent-line); color: var(--accent); }

/* Inline numeric units (×, L=, m) */
.inline {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--fg-subtle);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.num-sm {
  width: 52px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* Metrics readout — pushed right, monospace, color-coded */
.metrics {
  display: flex;
  gap: 0;
  color: var(--fg-dim);
  margin-left: auto;
  padding: 0;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  overflow: hidden;
  font-size: 10px;
}
.metrics span {
  padding: 3px 8px;
  border-right: 1px solid var(--border-soft);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.metrics span:last-child { border-right: 0; }
.metrics span:first-child { color: var(--accent); }

/* Status message — fault hint under the row */
.status-message {
  margin: 2px 0 4px 60px;
  font-size: 10px;
  color: var(--warn);
  padding: 2px 6px;
  border-left: 2px solid var(--warn);
  background: var(--warn-soft);
  border-radius: 0 2px 2px 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>

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
.row {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  background: var(--bg-1);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  flex-wrap: wrap;
}
.id { color: var(--fg-subtle); min-width: 54px; }
.label-input { width: 120px; }
.amp-btn { background: var(--bg-2); }
.inline { display: inline-flex; align-items: center; gap: 4px; color: var(--fg-dim); font-size: 12px; }
.num-sm { width: 64px; }
.metrics {
  display: flex;
  gap: 10px;
  color: var(--fg-dim);
  margin-left: auto;
}
.status-message { margin: 2px 0 6px 12px; font-size: 11px; }
</style>

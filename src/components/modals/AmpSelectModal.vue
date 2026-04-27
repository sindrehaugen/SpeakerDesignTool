<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'
import { useDatabaseStore } from '@/stores/database'

const ui = useUiStore()
const project = useProjectStore()
const database = useDatabaseStore()

const selectedModel = ref<string>('')
const useExisting = ref<string>('')
const channel = ref<number>(1)
const bridge = ref<boolean>(false)

const amps = computed(() => Object.values(database.data.amplifiers))
const instances = computed(() => Object.values(project.ampRack))

function assign(): void {
  const node = ui.pendingAmpNode
  if (!node) return close()
  let instId = useExisting.value
  if (!instId) {
    if (!selectedModel.value) return
    instId = project.addAmpInstance(selectedModel.value).id
  }
  node.ampInstanceId = instId
  node.ampChannel = channel.value
  node.useBridgeMode = bridge.value
  close()
}

function close(): void {
  ui.showAmpModal = false
  ui.pendingAmpNode = null
  selectedModel.value = ''
  useExisting.value = ''
}
</script>

<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal">
      <h2>Assign Amplifier</h2>
      <p class="muted">Pick an existing instance from the rack, or create a new one from a model.</p>

      <section class="group">
        <label>Existing instance</label>
        <select v-model="useExisting">
          <option value="">— none —</option>
          <option v-for="i in instances" :key="i.id" :value="i.id">
            {{ i.id }} · {{ database.data.amplifiers[i.modelId]?.brand }}
            {{ database.data.amplifiers[i.modelId]?.model }}
          </option>
        </select>
      </section>

      <section class="group">
        <label>Or new from model</label>
        <select v-model="selectedModel" :disabled="!!useExisting">
          <option value="">— pick model —</option>
          <option v-for="a in amps" :key="a.id" :value="a.id">
            {{ a.brand }} {{ a.model }}
          </option>
        </select>
      </section>

      <section class="row">
        <label>Channel
          <input type="number" min="1" v-model.number="channel" />
        </label>
        <label class="check">
          <input type="checkbox" v-model="bridge" /> Bridge mode
        </label>
      </section>

      <footer>
        <button class="ghost" @click="close">Cancel</button>
        <button class="primary" @click="assign">Assign</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
:deep(h2) {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  color: var(--fg);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
:deep(h2)::before {
  content: "▸ ";
  color: var(--accent);
}

.muted {
  color: var(--fg-subtle);
  font-size: 11px;
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0;
  padding: 8px 10px;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
}
.group label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
}
.group select {
  font-family: var(--font-mono);
  font-size: 12px;
}

.row {
  display: flex;
  gap: 12px;
  margin: 8px 0;
  padding: 8px 10px;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  align-items: center;
}
.row label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--fg-dim);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
}
.check input { width: auto; height: auto; }

footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border-soft);
}
</style>

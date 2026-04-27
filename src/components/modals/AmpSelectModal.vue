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
.group { display: flex; flex-direction: column; gap: 4px; margin: 12px 0; }
.row { display: flex; gap: 16px; margin: 12px 0; }
.check { display: inline-flex; align-items: center; gap: 6px; color: var(--fg-dim); }
footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>

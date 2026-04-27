<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'
import { useDatabaseStore } from '@/stores/database'
import { runCableWizard, type WizardCandidate } from '@/services/wizard'

const ui = useUiStore()
const project = useProjectStore()
const database = useDatabaseStore()

const limit = ref(ui.wizard.limit)
const brand = ref('')

const candidates = ref<WizardCandidate[]>([])

const brands = computed(() => database.brandsFor('cables'))

watch(
  [() => ui.wizard.visible, limit, brand],
  () => {
    if (!ui.wizard.visible || !ui.wizard.targetNode) return
    candidates.value = runCableWizard(
      ui.wizard.targetNode,
      database.data,
      project.mode,
      project.settings.temp_c,
      limit.value,
      brand.value || undefined,
    )
  },
  { immediate: true },
)

function pick(c: WizardCandidate): void {
  if (!ui.wizard.targetNode) return
  ui.wizard.targetNode.cableId = c.id
  close()
}

function close(): void {
  ui.wizard.visible = false
  ui.wizard.targetNode = null
}
</script>

<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal wide">
      <h2>Cable Wizard</h2>
      <p class="muted">
        Finds cables meeting your voltage-drop target for this run.
        Sorted by drop. Target: {{ limit }}%.
      </p>

      <section class="filters">
        <label>Max drop %
          <input type="number" min="0.5" max="25" step="0.5" v-model.number="limit" />
        </label>
        <label>Brand
          <select v-model="brand">
            <option value="">All</option>
            <option v-for="b in brands" :key="b" :value="b">{{ b }}</option>
          </select>
        </label>
      </section>

      <table class="table">
        <thead>
          <tr>
            <th>Brand</th><th>Model</th><th>mm²</th><th>Ω/km</th>
            <th>Load Ω</th><th>Drop %</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in candidates" :key="c.id" :class="{ pass: c.drop <= limit }">
            <td>{{ c.brand }}</td>
            <td>{{ c.model }}</td>
            <td>{{ c.crossSection ?? '-' }}</td>
            <td>{{ c.resistance }}</td>
            <td>{{ c.loadZ.toFixed(1) }}</td>
            <td>{{ c.drop.toFixed(2) }}</td>
            <td><button @click="pick(c)">Use</button></td>
          </tr>
          <tr v-if="!candidates.length">
            <td colspan="7" class="muted">No candidates match.</td>
          </tr>
        </tbody>
      </table>

      <footer>
        <button class="ghost" @click="close">Close</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.modal.wide { min-width: 700px; }
.filters { display: flex; gap: 16px; margin: 12px 0; }
.filters label { display: flex; flex-direction: column; gap: 4px; }
.pass td { color: var(--accent); }
footer { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>

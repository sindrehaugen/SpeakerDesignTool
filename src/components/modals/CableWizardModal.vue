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
.modal.wide { min-width: 760px; }

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
  content: "🪄 ";
  color: var(--accent);
  filter: hue-rotate(180deg) saturate(2);
}

.muted {
  color: var(--fg-subtle);
  font-size: 11px;
  line-height: 1.5;
  margin: 0 0 10px 0;
  font-family: var(--font-mono);
}

.filters {
  display: flex;
  gap: 8px;
  margin: 8px 0;
  padding: 8px 10px;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  align-items: end;
}
.filters label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
}

/* Candidate ledger */
:deep(.table) {
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  overflow: hidden;
  font-size: 11px;
}
:deep(.table th) {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  color: var(--accent);
  background: var(--bg-1);
  height: 24px;
  border-bottom: 1px solid var(--border);
}
:deep(.table td) {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  padding: 3px 8px;
  height: 24px;
  border-bottom: 1px solid var(--border-soft);
}
:deep(.table tbody tr:hover) { background: var(--bg-2); }
:deep(.table tr.pass td) {
  color: var(--ok);
  background: rgba(52,211,153,0.04);
}
:deep(.table tr.pass td:first-child) {
  border-left: 2px solid var(--ok);
}
:deep(.table button) {
  height: 20px;
  padding: 0 8px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
}

footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border-soft);
}
</style>

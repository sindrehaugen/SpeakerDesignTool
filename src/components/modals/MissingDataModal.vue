<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const form = reactive<Record<string, unknown>>({})

watch(
  () => ui.missingData.visible,
  (v) => { if (v) Object.assign(form, ui.missingData.initialData) },
  { immediate: true },
)

function save(): void {
  Object.assign(ui.missingData.initialData, form)
  ui.missingData.visible = false
}

function close(): void {
  ui.missingData.visible = false
}
</script>

<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal">
      <h2>{{ ui.missingData.title }}</h2>
      <p class="muted">Fill in the missing fields to continue.</p>

      <div class="fields">
        <label v-for="f in ui.missingData.fields" :key="f.key">
          {{ f.label }}
          <input v-model="form[f.key]" />
        </label>
      </div>

      <footer>
        <button class="ghost" @click="close">Cancel</button>
        <button class="primary" @click="save">Save</button>
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
  color: var(--warn);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
:deep(h2)::before {
  content: "⚠ ";
  color: var(--warn);
}

.muted {
  color: var(--fg-subtle);
  font-size: 11px;
  margin: 0 0 10px 0;
  padding: 6px 10px;
  background: var(--warn-soft);
  border: 1px solid rgba(245,165,36,0.3);
  border-left: 2px solid var(--warn);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-family: var(--font-mono);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 8px 0;
  padding: 8px 10px;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
}
.fields label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
}
.fields input {
  font-family: var(--font-mono);
  font-size: 12px;
  text-align: left;
}

footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border-soft);
}
</style>

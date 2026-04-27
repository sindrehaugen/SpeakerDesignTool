<script setup lang="ts">
import { ref } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'
import { exportProjectJson } from '@/services/io'

const ui = useUiStore()
const project = useProjectStore()

const includeDb = ref(true)
const fileName = ref(project.projectInfo.name)

function save(): void {
  exportProjectJson(project.serialize(includeDb.value), fileName.value)
  ui.showSaveModal = false
}
</script>

<template>
  <div class="modal-backdrop" @click.self="ui.showSaveModal = false">
    <div class="modal">
      <h2>Save Project</h2>

      <div class="fields">
        <label>
          File name
          <input v-model="fileName" />
        </label>
        <label class="check">
          <input type="checkbox" v-model="includeDb" />
          Include equipment database
        </label>
      </div>

      <footer>
        <button class="ghost" @click="ui.showSaveModal = false">Cancel</button>
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
  color: var(--fg);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
:deep(h2)::before {
  content: "▾ ";
  color: var(--accent);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0;
  padding: 8px 10px;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
}
.fields > label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
}
.fields input[type="text"],
.fields > label > input {
  font-family: var(--font-mono);
  font-size: 12px;
  text-align: left;
}

.check {
  flex-direction: row !important;
  align-items: center;
  gap: 6px;
  color: var(--fg-dim);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 4px 0;
  cursor: pointer;
}
.check input {
  width: auto;
  height: auto;
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

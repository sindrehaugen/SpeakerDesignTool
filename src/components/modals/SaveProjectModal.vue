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
.fields { display: flex; flex-direction: column; gap: 12px; margin: 12px 0; }
.fields label { display: flex; flex-direction: column; gap: 4px; }
.check { flex-direction: row !important; align-items: center; gap: 6px; color: var(--fg-dim); }
footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>

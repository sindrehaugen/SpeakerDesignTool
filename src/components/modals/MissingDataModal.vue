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
.fields { display: flex; flex-direction: column; gap: 10px; margin: 12px 0; }
.fields label { display: flex; flex-direction: column; gap: 4px; }
footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>

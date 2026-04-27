<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import AppHeader from '@/components/AppHeader.vue'
import CalculatorView from '@/views/CalculatorView.vue'
import DatabaseView from '@/views/DatabaseView.vue'
import RoomView from '@/views/RoomView.vue'
import CalculatorsView from '@/views/CalculatorsView.vue'
import ReportsView from '@/views/ReportsView.vue'
import ReferenceView from '@/views/ReferenceView.vue'
import AmpSelectModal from '@/components/modals/AmpSelectModal.vue'
import CableWizardModal from '@/components/modals/CableWizardModal.vue'
import MissingDataModal from '@/components/modals/MissingDataModal.vue'
import SaveProjectModal from '@/components/modals/SaveProjectModal.vue'

const ui = useUiStore()

const view = computed(() => {
  switch (ui.currentView) {
    case 'calculator': return CalculatorView
    case 'database':   return DatabaseView
    case 'room':       return RoomView
    case 'calculators':return CalculatorsView
    case 'reports':    return ReportsView
    case 'reference':  return ReferenceView
    default:           return CalculatorView
  }
})
</script>

<template>
  <div class="app-root">
    <AppHeader />
    <main class="app-main">
      <component :is="view" />
    </main>

    <AmpSelectModal v-if="ui.showAmpModal" />
    <CableWizardModal v-if="ui.wizard.visible" />
    <MissingDataModal v-if="ui.missingData.visible" />
    <SaveProjectModal v-if="ui.showSaveModal" />
  </div>
</template>

<style scoped>
.app-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.app-main {
  flex: 1;
  overflow: auto;
  padding: 16px;
}
</style>

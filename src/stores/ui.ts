import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SignalNode } from '@/types/domain'

export type ViewName = 'calculator' | 'database' | 'room' | 'calculators' | 'reports' | 'reference'

export const useUiStore = defineStore('ui', () => {
  const currentView = ref<ViewName>('calculator')
  const showAmpModal = ref(false)
  const showSaveModal = ref(false)
  const pendingAmpNode = ref<SignalNode | null>(null)

  const wizard = ref<{
    visible: boolean
    candidates: Array<Record<string, unknown>>
    limit: number
    targetNode: SignalNode | null
  }>({ visible: false, candidates: [], limit: 5, targetNode: null })

  const missingData = ref<{
    visible: boolean
    title: string
    fields: Array<{ key: string; label: string }>
    initialData: Record<string, unknown>
  }>({ visible: false, title: '', fields: [], initialData: {} })

  return {
    currentView,
    showAmpModal, showSaveModal, pendingAmpNode,
    wizard, missingData,
  }
})

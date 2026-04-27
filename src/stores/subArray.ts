/** Sub-array designer store — persistent state for the beamforming designer.
 *
 *  Supports a library of multiple named arrays and auto-populates cabinet
 *  dimensions from the equipment database when a speaker is assigned.
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { SubUnit, SubArrayConfig, SubPreset } from '@/types/domain'
import {
  endfire, broadside, cardioidPair, cardioidTriple, arcArray,
  polarResponse, directivityDb, frontToBackDb,
} from '@/core/subArray'
import { speedOfSound } from '@/core/mvv'
import { read, write } from '@/services/storage'
import { useDatabaseStore } from '@/stores/database'

const STORAGE_KEY = 'sdt_subarray_v4'

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function defaultConfig(): SubArrayConfig {
  const c = speedOfSound(20, 50, 101325)
  return {
    id: generateId(),
    name: 'Array 1',
    preset: 'endfire',
    units: endfire(2, 1, c),
    count: 2,
    spacing: 1.0,
    splayDeg: 15,
    analysisFreq: 80,
    fieldExtent: 10,
    boxW: 0.60,
    boxH: 0.60,
    boxD: 0.60,
  }
}

interface StoredState {
  arrays: SubArrayConfig[]
  activeId: string
}

function loadFromStorage(): StoredState {
  try {
    const raw = read(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Migration from single-config (earlier beta) to multiple arrays
      if (!parsed.arrays && parsed.preset) {
        const migratedConfig = { ...defaultConfig(), ...parsed, id: generateId() }
        return { arrays: [migratedConfig], activeId: migratedConfig.id }
      }
      if (parsed.arrays?.length) {
        return parsed as StoredState
      }
    }
  } catch (e) {
    console.warn('[subArray store] load error:', e)
  }
  const def = defaultConfig()
  return { arrays: [def], activeId: def.id }
}

export const useSubArrayStore = defineStore('subArray', () => {
  const dbStore = useDatabaseStore()
  
  const state = ref<StoredState>(loadFromStorage())

  // Environment
  const tempC = ref(20)
  const rh = ref(50)
  const pAtm = ref(101325)
  const c = computed(() => speedOfSound(tempC.value, rh.value, pAtm.value))

  // Active array reference
  const activeArray = computed(() => {
    return state.value.arrays.find(a => a.id === state.value.activeId) ?? state.value.arrays[0]!
  })

  // Persist
  watch(
    state,
    (v) => {
      try { write(STORAGE_KEY, JSON.stringify(v)) }
      catch (e) { console.warn('[subArray store] save error:', e) }
    },
    { deep: true },
  )

  // ─── Derived / computed for active array ───────────────────────────────

  const config = activeArray
  const units = computed(() => activeArray.value.units)
  const analysisFreq = computed(() => activeArray.value.analysisFreq)

  const polarData = computed(() =>
    polarResponse(units.value, analysisFreq.value, c.value, 361),
  )
  const forwardDb = computed(() =>
    directivityDb(units.value, analysisFreq.value, 0, c.value),
  )
  const rearDb = computed(() =>
    directivityDb(units.value, analysisFreq.value, 180, c.value),
  )
  const fbRatio = computed(() =>
    frontToBackDb(units.value, analysisFreq.value, c.value),
  )

  // ─── Actions for Library Management ──────────────────────────────────────

  function createNewArray(): void {
    const next = defaultConfig()
    next.name = `Array ${state.value.arrays.length + 1}`
    state.value.arrays.push(next)
    state.value.activeId = next.id
  }

  function deleteActiveArray(): void {
    if (state.value.arrays.length <= 1) {
      reset()
      return
    }
    const idx = state.value.arrays.findIndex(a => a.id === state.value.activeId)
    state.value.arrays.splice(idx, 1)
    state.value.activeId = state.value.arrays[Math.max(0, idx - 1)]!.id
  }

  function duplicateActiveArray(): void {
    const dup = JSON.parse(JSON.stringify(activeArray.value)) as SubArrayConfig
    dup.id = generateId()
    dup.name = `${dup.name} (copy)`
    state.value.arrays.push(dup)
    state.value.activeId = dup.id
  }

  function switchArray(id: string): void {
    if (state.value.arrays.find(a => a.id === id)) {
      state.value.activeId = id
    }
  }

  function renameActiveArray(newName: string): void {
    activeArray.value.name = newName || 'Unnamed Array'
  }

  // ─── Actions for Active Array ────────────────────────────────────────────

  function rebuildFromPreset(): void {
    const cNow = c.value
    const arr = activeArray.value
    switch (arr.preset) {
      case 'endfire':    arr.units = endfire(arr.count, arr.spacing, cNow); break
      case 'broadside':  arr.units = broadside(arr.count, arr.spacing); break
      case 'cardioid2':  arr.units = cardioidPair(arr.spacing, cNow); break
      case 'cardioid3':  arr.units = cardioidTriple(arr.spacing, cNow); break
      case 'arc':        arr.units = arcArray(arr.count, arr.spacing, arr.splayDeg); break
      case 'custom':     break // leave as-is
    }
    // Re-apply global speaker ID if one is dominant
    const primarySpeakerId = arr.units[0]?.speakerId
    if (primarySpeakerId) {
      assignSpeakerToAll(primarySpeakerId)
    }
  }

  function selectPreset(p: SubPreset): void {
    activeArray.value.preset = p
    rebuildFromPreset()
  }

  function setCount(n: number): void {
    activeArray.value.count = n
    if (activeArray.value.preset !== 'custom') rebuildFromPreset()
  }

  function setSpacing(s: number): void {
    activeArray.value.spacing = s
    if (activeArray.value.preset !== 'custom') rebuildFromPreset()
  }

  function setSplay(deg: number): void {
    activeArray.value.splayDeg = deg
    if (activeArray.value.preset === 'arc') rebuildFromPreset()
  }

  function updateUnit(index: number, patch: Partial<SubUnit>): void {
    activeArray.value.preset = 'custom'
    activeArray.value.units[index] = { ...activeArray.value.units[index]!, ...patch }
  }

  function addUnit(): void {
    activeArray.value.preset = 'custom'
    const len = activeArray.value.units.length
    const lastSpk = len > 0 ? activeArray.value.units[len-1]!.speakerId : undefined
    activeArray.value.units.push({
      x: 0, y: 0, delay: 0, polarity: 1, gain: 1,
      label: `Sub ${len + 1}`,
      speakerId: lastSpk
    })
  }

  function removeUnit(index: number): void {
    activeArray.value.preset = 'custom'
    activeArray.value.units.splice(index, 1)
  }

  function applySpeakerDimensions(speakerId: string): void {
    const spk = dbStore.data.speakers[speakerId]
    if (spk) {
      // Auto-fill cabinet dimensions if present in database
      if (spk.widthM) activeArray.value.boxW = spk.widthM
      if (spk.heightM) activeArray.value.boxH = spk.heightM
      if (spk.depthM) activeArray.value.boxD = spk.depthM
    }
  }

  function assignSpeaker(index: number, speakerId: string): void {
    activeArray.value.units[index]!.speakerId = speakerId
    if (speakerId) applySpeakerDimensions(speakerId)
  }

  function assignSpeakerToAll(speakerId: string): void {
    activeArray.value.units.forEach(u => { u.speakerId = speakerId })
    if (speakerId) applySpeakerDimensions(speakerId)
  }

  function reset(): void {
    const def = defaultConfig()
    state.value = { arrays: [def], activeId: def.id }
  }

  return {
    state, config, activeArray, tempC, rh, pAtm, c,
    units, analysisFreq,
    polarData, forwardDb, rearDb, fbRatio,
    
    // Library
    createNewArray, deleteActiveArray, duplicateActiveArray,
    switchArray, renameActiveArray,
    
    // Editor
    selectPreset, setCount, setSpacing, setSplay,
    updateUnit, addUnit, removeUnit,
    assignSpeaker, assignSpeakerToAll,
    rebuildFromPreset, reset,
  }
})

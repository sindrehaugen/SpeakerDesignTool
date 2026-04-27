/** Project store — the reactive core that replaces calculateAll().
 *
 *  Inputs (state): roots + amps + mode + quality + temperature + db
 *  Outputs (computed): analysis Map<nodeId, NodeAnalysis>
 *
 *  UI mutates state, derivations recompute automatically. No more
 *  imperative 117-line recalc from 8 callsites.
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  SignalNode, AmpInstance, SystemMode, QualityMode,
  ProjectInfo, ReportInfo, Settings,
} from '@/types/domain'
import { QUALITY_PROFILES } from '@/data/defaultDatabase'
import { analyseChain } from '@/core/engine'
import { makeGrid } from '@/core/grid'
import { read, write } from '@/services/storage'
import { useDatabaseStore } from './database'

const PREFS_KEY = 'sdt_user_prefs_v4'

export function newNodeId(prefix: string, siblings: SignalNode[]): string {
  let max = 0
  for (const n of siblings) {
    const last = n.id.split('.').pop() ?? ''
    const num = parseInt(last.replace(/^[LH]-/, ''), 10)
    if (!Number.isNaN(num) && num > max) max = num
  }
  return `${prefix}-${max + 1}`
}

export function childNodeId(parent: SignalNode): string {
  let max = 0
  for (const c of parent.children) {
    const last = c.id.split('.').pop() ?? ''
    const num = parseInt(last, 10)
    if (!Number.isNaN(num) && num > max) max = num
  }
  return `${parent.id}.${max + 1}`
}

function emptyNode(id: string, parentId: string | null, defaults: Partial<SignalNode>): SignalNode {
  return {
    id, parentId, userLabel: '',
    ampInstanceId: '', ampChannel: null, useBridgeMode: false,
    speakerId: 'Default Speaker', parallelCount: 1, tapPower: 0,
    cableId: 'Default Cable 1.5mm²', length: 20,
    useCable2: false, cable2Id: '', length2: 0,
    children: [], results: { status: 'Pending' },
    ...defaults,
  }
}

export const useProjectStore = defineStore('project', () => {
  const database = useDatabaseStore()

  const mode = ref<SystemMode>('low-z')
  const qualityMode = ref<QualityMode>('high-end')
  const projectInfo = ref<ProjectInfo>({
    name: 'Project 1',
    date: new Date().toISOString().split('T')[0]!,
  })
  const reportInfo = ref<ReportInfo>({ company: '', designer: '', logoUrl: '' })
  const settings = ref<Settings>({ temp_c: 25, freqGridPoints: 48 })
  const ampRack = ref<Record<string, AmpInstance>>({})
  const lowZRoots = ref<SignalNode[]>([])
  const highVRoots = ref<SignalNode[]>([])

  try {
    const raw = read(PREFS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { reportInfo?: ReportInfo; settings?: Settings }
      if (p.reportInfo) Object.assign(reportInfo.value, p.reportInfo)
      if (p.settings) Object.assign(settings.value, p.settings)
    }
  } catch {}

  watch(
    [reportInfo, settings],
    () => {
      try {
        write(PREFS_KEY, JSON.stringify({
          reportInfo: reportInfo.value,
          settings: settings.value,
        }))
      } catch {}
    },
    { deep: true },
  )

  const profile = computed(() => QUALITY_PROFILES[qualityMode.value])
  const grid = computed(() => makeGrid(settings.value.freqGridPoints ?? 48))

  const activeRoots = computed(() =>
    mode.value === 'low-z' ? lowZRoots.value : highVRoots.value,
  )

  /** The reactive derivation that replaces calculateAll(). */
  const analysis = computed(() =>
    analyseChain({
      roots: activeRoots.value,
      db: database.data,
      ampRack: ampRack.value,
      mode: mode.value,
      quality: profile.value,
      tempC: settings.value.temp_c,
      grid: grid.value,
    }),
  )

  const allNodes = computed(() => {
    const out: SignalNode[] = []
    const walk = (n: SignalNode) => {
      out.push(n)
      n.children.forEach(walk)
    }
    activeRoots.value.forEach(walk)
    return out
  })

  function findNode(id: string): SignalNode | null {
    const search = (nodes: SignalNode[]): SignalNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n
        const hit = search(n.children)
        if (hit) return hit
      }
      return null
    }
    return search(lowZRoots.value) ?? search(highVRoots.value)
  }

  function addRoot(): SignalNode {
    const prefix = mode.value === 'low-z' ? 'L' : 'H'
    const roots = activeRoots.value
    const node = emptyNode(newNodeId(prefix, roots), null, {
      tapPower: mode.value === 'high-v' ? 10 : 0,
    })
    roots.push(node)
    return node
  }

  function addChild(parentId: string): SignalNode | null {
    const parent = findNode(parentId)
    if (!parent) return null
    const child = emptyNode(childNodeId(parent), parent.id, {
      speakerId: parent.speakerId,
      cableId: parent.cableId,
      length: 5,
      tapPower: parent.tapPower,
    })
    parent.children.push(child)
    return child
  }

  function removeNode(id: string): void {
    const strip = (nodes: SignalNode[]): boolean => {
      const idx = nodes.findIndex((n) => n.id === id)
      if (idx > -1) {
        nodes.splice(idx, 1)
        return true
      }
      for (const n of nodes) if (strip(n.children)) return true
      return false
    }
    strip(lowZRoots.value) || strip(highVRoots.value)
  }

  function addAmpInstance(modelId: string): AmpInstance {
    const id = `A-${Object.keys(ampRack.value).length + 1}`
    const inst: AmpInstance = { id, modelId, channelsUsed: [] }
    ampRack.value[id] = inst
    return inst
  }

  function clearProject(): void {
    lowZRoots.value = []
    highVRoots.value = []
    ampRack.value = {}
  }

  function loadProjectJson(payload: {
    lowZ?: SignalNode[]; highV?: SignalNode[];
    ampRack?: Record<string, AmpInstance>;
    mode?: SystemMode; qualityMode?: QualityMode;
    projectInfo?: ProjectInfo; reportInfo?: ReportInfo;
    settings?: Settings;
  }): void {
    if (payload.lowZ) lowZRoots.value = payload.lowZ
    if (payload.highV) highVRoots.value = payload.highV
    if (payload.ampRack) ampRack.value = payload.ampRack
    if (payload.mode) mode.value = payload.mode
    if (payload.qualityMode) qualityMode.value = payload.qualityMode
    if (payload.projectInfo) projectInfo.value = payload.projectInfo
    if (payload.reportInfo) Object.assign(reportInfo.value, payload.reportInfo)
    if (payload.settings) Object.assign(settings.value, payload.settings)
  }

  function serialize(includeDatabase = false) {
    return {
      mode: mode.value,
      qualityMode: qualityMode.value,
      projectInfo: projectInfo.value,
      reportInfo: reportInfo.value,
      settings: settings.value,
      ampRack: ampRack.value,
      lowZ: lowZRoots.value,
      highV: highVRoots.value,
      ...(includeDatabase ? { database: database.data } : {}),
    }
  }

  return {
    mode, qualityMode, projectInfo, reportInfo, settings,
    ampRack, lowZRoots, highVRoots,
    profile, grid, activeRoots, analysis, allNodes,
    findNode, addRoot, addChild, removeNode,
    addAmpInstance, clearProject, loadProjectJson, serialize,
  }
})

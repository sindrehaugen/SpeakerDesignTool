/** High-level physics orchestrator — takes a signal-chain tree and produces
 *  per-node spectral results. This replaces the monolithic calculateAll()
 *  god function from the legacy codebase with a pure, testable function.
 *
 *  Design:
 *    - No side effects. Returns a new Map<nodeId, NodeAnalysis>.
 *    - Recursive: handles arbitrary daisy-chain depth.
 *    - Spectral: every result is a function of frequency (array across grid).
 *    - Scalar summaries (minLoad, dropPercent at 1 kHz) are derived from the
 *      spectral data at the end.
 */

import { Complex, parallel } from './complex'
import { cableImpedance, seriesImpedance } from './cable'
import { speakerImpedance } from './driver'
import { reflectedImpedance } from './transformer'
import { transmission, ratioToDb } from './transmission'
import { nearestIndex } from './grid'
import type {
  SignalNode,
  EquipmentDatabase,
  SystemMode,
  QualityProfile,
  NodeResults,
  Speaker,
} from '@/types/domain'
import type {
  BranchAnalysis,
  FrequencyGrid,
  SpectralImpedance,
  SpectralMagnitude,
} from '@/types/physics'

export interface ChainInput {
  roots: SignalNode[]
  db: EquipmentDatabase
  ampRack: Record<string, { id: string; modelId: string; channelsUsed: number[] }>
  mode: SystemMode
  quality: QualityProfile
  tempC: number
  grid: FrequencyGrid
}

export interface NodeAnalysis {
  branch: BranchAnalysis
  results: NodeResults
}

export type ChainAnalysis = Map<string, NodeAnalysis>

const MAX_IMPEDANCE = 1e9

function spkImpedance(spk: Speaker | undefined, parallelCount: number, grid: FrequencyGrid): SpectralImpedance {
  if (!spk) return grid.map(() => new Complex(MAX_IMPEDANCE, 0))
  return speakerImpedance(spk, parallelCount, grid)
}

/** Effective load Z(f) looking into a node — recursive parallel sum with
 *  child cable impedances added in series on each branch.
 */
function effectiveLoad(node: SignalNode, db: EquipmentDatabase, tempC: number, grid: FrequencyGrid): SpectralImpedance {
  const spk = db.speakers[node.speakerId]
  const own = spkImpedance(spk, node.parallelCount || 1, grid)
  if (!node.children?.length) return own

  const branches: SpectralImpedance[] = [own]
  for (const child of node.children) {
    const childLoad = effectiveLoad(child, db, tempC, grid)
    const c1 = db.cables[child.cableId]
    let zCab: SpectralImpedance = c1 ? cableImpedance(c1, child.length, tempC, grid) : grid.map(() => Complex.ZERO)
    if (child.useCable2 && child.cable2Id) {
      const c2 = db.cables[child.cable2Id]
      if (c2) zCab = seriesImpedance(zCab, cableImpedance(c2, child.length2, tempC, grid))
    }
    const branchZ = grid.map((_, i) => childLoad[i]!.add(zCab[i]!))
    branches.push(branchZ)
  }

  // Parallel combine per frequency.
  const out = new Array<Complex>(grid.length)
  for (let i = 0; i < grid.length; i++) {
    out[i] = parallel(branches.map((b) => b[i]!))
  }
  return out
}

function totalTapPower(node: SignalNode): number {
  let w = Number(node.tapPower) || 0
  for (const c of node.children) w += totalTapPower(c)
  return w
}

function totalRmsPower(node: SignalNode, db: EquipmentDatabase): number {
  const spk = db.speakers[node.speakerId]
  let p = spk ? spk.wattage_rms * Math.max(1, node.parallelCount || 1) : 0
  for (const c of node.children) p += totalRmsPower(c, db)
  return p
}

/** Source voltage for a root node based on amplifier config. */
function rootSourceVoltage(node: SignalNode, input: ChainInput): number {
  const { mode, db, ampRack } = input
  if (node.ampInstanceId && ampRack[node.ampInstanceId]) {
    const inst = ampRack[node.ampInstanceId]!
    const m = db.amplifiers[inst.modelId]
    if (m) {
      if (mode === 'high-v') return 100
      const p = node.useBridgeMode ? m.watt_bridge_8 ?? m.watt_8 ?? 0 : m.watt_8 ?? 0
      return Math.sqrt(Math.max(0, p) * 8)
    }
  }
  // Default fallback: 100V for distributed, or √(100W·8Ω)=28.28 V for Low-Z.
  return mode === 'high-v' ? 100 : Math.sqrt(100 * 8)
}

/** Evaluate a single node given the voltage presented at its input. */
function analyzeNode(
  node: SignalNode,
  srcVoltage: number,
  input: ChainInput,
): { branch: BranchAnalysis; tipVoltage: SpectralMagnitude } {
  const { db, grid, tempC, mode, quality } = input

  const cable = db.cables[node.cableId]
  let cableZ: SpectralImpedance = cable
    ? cableImpedance(cable, node.length, tempC, grid)
    : grid.map(() => Complex.ZERO)
  if (node.useCable2 && node.cable2Id) {
    const c2 = db.cables[node.cable2Id]
    if (c2) cableZ = seriesImpedance(cableZ, cableImpedance(c2, node.length2, tempC, grid))
  }

  const loadZ: SpectralImpedance =
    mode === 'high-v'
      ? grid.map(() => new Complex(reflectedImpedance(totalTapPower(node), 100), 0))
      : effectiveLoad(node, db, tempC, grid)

  const tx = transmission(srcVoltage, loadZ, cableZ, grid)

  const branch: BranchAnalysis = {
    frequencies: grid,
    cableImpedance: cableZ,
    loadImpedance: loadZ,
    transmission: tx,
  }
  return { branch, tipVoltage: tx.voltageAtLoad }
}

/** Judge status against the quality profile. */
function grade(
  results: NodeResults,
  node: SignalNode,
  input: ChainInput,
): NodeResults {
  const { quality, mode, db, ampRack } = input
  const msg: string[] = []
  let status: NodeResults['status'] = 'OK'

  if ((results.dropPercent ?? 0) > quality.maxDrop) {
    status = 'Warning'
    msg.push('High drop')
  }
  if ((results.dropPercent ?? 0) > quality.maxDrop * 1.5) {
    status = 'Error'
    msg[msg.length - 1] = 'Critical drop'
  }
  if (Math.abs(results.hfLossDb ?? 0) > 0.5 && status !== 'Error') {
    status = 'Warning'
    msg.push('HF loss')
  }

  // Amp headroom (only meaningful on root nodes with an assigned amp).
  if (!node.parentId && node.ampInstanceId && ampRack[node.ampInstanceId]) {
    const inst = ampRack[node.ampInstanceId]!
    const amp = db.amplifiers[inst.modelId]
    if (amp) {
      const totalLoad = results.minLoad ?? 8
      let cap = 0
      if (mode === 'low-z') {
        if (node.useBridgeMode) {
          cap = totalLoad < 6 ? amp.watt_bridge_4 ?? 0 : amp.watt_bridge_8 ?? 0
          if (cap === 0 && amp.watt_bridge_8) cap = amp.watt_bridge_8
        } else {
          if (totalLoad < 3) cap = amp.watt_2 ?? 0
          else if (totalLoad < 6) cap = amp.watt_4 ?? 0
          else cap = amp.watt_8 ?? 0
          if (cap === 0) cap = amp.watt_4 ?? amp.watt_8 ?? 0
        }
        const required = totalRmsPower(node, db)
        results.headroomPct = cap > 0 ? (required / cap) * 100 : 0
      } else {
        cap = amp.watt_100v ?? amp.watt_8 ?? 0
        results.headroomPct = cap > 0 ? ((results.totalPower ?? 0) / cap) * 100 : 0
      }
      if ((results.headroomPct ?? 0) > 80) {
        status = status === 'Error' ? 'Error' : 'Warning'
        msg.push(`Headroom ${Math.round(results.headroomPct!)}%`)
      }
      if ((results.headroomPct ?? 0) > 100) {
        status = 'Error'
        msg[msg.length - 1] = `Overload ${Math.round(results.headroomPct!)}%`
      }
    }
  }

  if (amplifierOverloaded(node, results, input)) {
    status = 'Error'
    msg.push('Amp min load')
  }

  return { ...results, status, statusMessage: msg.join(' · ') || undefined }
}

function amplifierOverloaded(node: SignalNode, results: NodeResults, input: ChainInput): boolean {
  if (node.parentId || !node.ampInstanceId) return false
  const inst = input.ampRack[node.ampInstanceId]
  if (!inst) return false
  const amp = input.db.amplifiers[inst.modelId]
  if (!amp) return false
  const minLoad = node.useBridgeMode ? amp.min_load_bridge ?? amp.min_load ?? 2 : amp.min_load ?? 2
  return (results.minLoad ?? 8) < minLoad
}

/** Main entry point — analyse the whole chain and return per-node results. */
export function analyseChain(input: ChainInput): ChainAnalysis {
  const out: ChainAnalysis = new Map()

  const walk = (node: SignalNode, parentVoltage: SpectralMagnitude | null): void => {
    let srcV: number
    if (!node.parentId || parentVoltage === null) {
      srcV = rootSourceVoltage(node, input)
    } else {
      const idx = nearestIndex(input.grid, 1000)
      srcV = parentVoltage[idx]!
    }
    const { branch, tipVoltage } = analyzeNode(node, srcV, input)
    const scalar = deriveScalar(branch, input, srcV)
    if (input.mode === 'high-v') scalar.totalPower = totalTapPower(node)
    const graded = grade(scalar, node, input)
    out.set(node.id, { branch, results: graded })
    for (const child of node.children) walk(child, tipVoltage)
  }

  for (const root of input.roots) walk(root, null)
  return out
}

function deriveScalar(branch: BranchAnalysis, input: ChainInput, srcV: number): NodeResults {
  const idx1k = nearestIndex(input.grid, 1000)
  const idxHf = nearestIndex(input.grid, input.quality.hfCheckHz)
  const { transmission: tx, cableImpedance: cz, loadImpedance: lz } = branch
  const vLoad = tx.voltageAtLoad[idx1k]!
  return {
    status: 'OK',
    minLoad: lz[idx1k]!.magnitude() + cz[idx1k]!.re,
    nomLoad: lz[idx1k]!.magnitude() + cz[idx1k]!.re,
    dropPercent: tx.dropPercent[idx1k]!,
    dropVolts: srcV - vLoad,
    voltageAtLoad: vLoad,
    current: tx.current[idx1k]!,
    hfLossDb: ratioToDb(vLoad, tx.voltageAtLoad[idxHf]!),
    elecLossDb: ratioToDb(srcV, vLoad),
  }
}

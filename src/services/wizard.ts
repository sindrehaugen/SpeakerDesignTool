/** Cable wizard: brute-force pick the most cost-effective cable that meets
 *  a voltage-drop target for a given run.
 */

import { cableImpedance } from '@/core/cable'
import { makeGrid, nearestIndex } from '@/core/grid'
import type { Cable, EquipmentDatabase, SignalNode, SystemMode } from '@/types/domain'
import { Complex } from '@/core/complex'

export interface WizardCandidate extends Cable {
  drop: number
  loadZ: number
}

export function runCableWizard(
  node: SignalNode,
  db: EquipmentDatabase,
  mode: SystemMode,
  tempC: number,
  limit: number,
  brandFilter?: string,
): WizardCandidate[] {
  const grid = makeGrid(24)
  const idx1k = nearestIndex(grid, 1000)

  let zLoadMag = 8
  if (mode === 'low-z') {
    const spk = db.speakers[node.speakerId]
    if (spk) zLoadMag = (spk.z_min ?? spk.impedance) / (node.parallelCount || 1)
  } else {
    const w = node.tapPower || 10
    zLoadMag = (100 * 100) / w
  }

  const sourceV = mode === 'low-z' ? Math.sqrt(100 * 8) : 100
  const out: WizardCandidate[] = []
  for (const cable of Object.values(db.cables)) {
    if (brandFilter && cable.brand !== brandFilter) continue
    const zCab = cableImpedance(cable, node.length, tempC, grid)[idx1k]!
    const total = zCab.add(new Complex(zLoadMag, 0))
    const iBr = total.magnitude() > 0 ? sourceV / total.magnitude() : 0
    const vLoad = iBr * zLoadMag
    const drop = ((sourceV - vLoad) / sourceV) * 100
    if (drop < limit * 1.5) out.push({ ...cable, drop, loadZ: zLoadMag })
  }
  out.sort((a, b) => a.drop - b.drop)
  return out
}

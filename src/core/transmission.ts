/** Voltage-divider transmission analysis across a spectral grid.
 *
 *  Source delivers V_src to a series chain: Z_cable(f) + Z_load(f).
 *
 *  I(f) = V_src / |Z_cable(f) + Z_load(f)|
 *  V_load(f) = I(f) · |Z_load(f)|
 *  P_load(f) = I(f)² · Re{Z_load(f)}
 */

import type { Complex } from './complex'
import type {
  FrequencyGrid,
  SpectralImpedance,
  SpectralTransmission,
} from '@/types/physics'

export function transmission(
  sourceVoltage: number,
  loadZ: SpectralImpedance,
  cableZ: SpectralImpedance,
  grid: FrequencyGrid,
): SpectralTransmission {
  const n = grid.length
  const voltageAtLoad = new Array<number>(n)
  const current = new Array<number>(n)
  const dropPercent = new Array<number>(n)
  const powerLoad = new Array<number>(n)
  const totalImpedance = new Array<number>(n)

  for (let i = 0; i < n; i++) {
    const z: Complex = cableZ[i]!.add(loadZ[i]!)
    const zMag = z.magnitude()
    const iMag = zMag > 0 ? sourceVoltage / zMag : 0
    const zLoadMag = loadZ[i]!.magnitude()
    const vLoad = iMag * zLoadMag
    const rLoad = Math.max(loadZ[i]!.re, 0)
    current[i] = iMag
    voltageAtLoad[i] = vLoad
    powerLoad[i] = iMag * iMag * rLoad
    totalImpedance[i] = zMag
    dropPercent[i] = sourceVoltage > 0 ? ((sourceVoltage - vLoad) / sourceVoltage) * 100 : 0
  }

  return { voltageAtLoad, current, dropPercent, powerLoad, totalImpedance }
}

/** Convert a voltage ratio to dB (negative = loss). */
export function ratioToDb(vRef: number, vOut: number): number {
  if (vRef <= 0 || vOut <= 0) return 0
  return 20 * Math.log10(vOut / vRef)
}

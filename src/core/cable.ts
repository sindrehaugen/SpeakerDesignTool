/** Cable transmission-line model — spectral impedance across frequency.
 *
 *  Model (per IEC/IEEE practice):
 *    R(f, T) = R_dc · (1 + α·(T − 20°C)) · [1 + k_skin·√(f/1000)]   (Ω, loop)
 *    X_L(f) = 2π·f·L                                                  (Ω)
 *    Z(f) = R(f,T) + j·X_L(f)
 *  Capacitive shunt is ignored for cable lengths < ~500 m at audio frequencies
 *  (|Y_C| ≪ 1/|Z|).
 */

import { Complex } from './complex'
import type { Cable } from '@/types/domain'
import type { FrequencyGrid, SpectralImpedance } from '@/types/physics'

/** Copper temperature coefficient per °C. */
export const TEMP_COEFF_COPPER = 0.00393

/** Compute loop DC resistance of a cable run, thermally compensated. */
export function loopResistanceDC(cable: Cable, lengthMeters: number, tempC: number): number {
  if (!cable || !lengthMeters) return 0
  const rBase = (cable.resistance * lengthMeters * 2) / 1000 // Ω loop
  return rBase * (1 + TEMP_COEFF_COPPER * (tempC - 20))
}

/** Compute loop inductance of a cable run (Henries). */
export function loopInductance(cable: Cable, lengthMeters: number): number {
  const lPerM = cable.inductance ?? 0.6 // µH/m
  return (lPerM * lengthMeters * 2) / 1_000_000 // H loop
}

/** Spectral complex impedance of a cable run across a frequency grid. */
export function cableImpedance(
  cable: Cable,
  lengthMeters: number,
  tempC: number,
  grid: FrequencyGrid,
): SpectralImpedance {
  const rDc = loopResistanceDC(cable, lengthMeters, tempC)
  const lH = loopInductance(cable, lengthMeters)
  const skinCoeff = cable.skinEffect ?? 0
  const out = new Array<Complex>(grid.length)
  for (let i = 0; i < grid.length; i++) {
    const f = grid[i]!
    const skin = skinCoeff > 0 ? 1 + skinCoeff * Math.sqrt(f / 1000) : 1
    const r = rDc * skin
    const xl = 2 * Math.PI * f * lH
    out[i] = new Complex(r, xl)
  }
  return out
}

/** Combine two cable segments in series (dual-segment runs). */
export function seriesImpedance(a: SpectralImpedance, b: SpectralImpedance): SpectralImpedance {
  if (a.length !== b.length) throw new Error('grid mismatch')
  const out = new Array<Complex>(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i]!.add(b[i]!)
  return out
}

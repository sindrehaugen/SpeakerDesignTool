/** Speaker-load impedance model.
 *
 *  We treat finished speakers as flat-impedance loads at their nominal (or
 *  measured minimum) impedance. Frequency-dependent behaviour above the box
 *  level (resonance peaks, voice-coil inductive rise) requires Thiele-Small
 *  data, which is only meaningful for raw drivers — not the finished speaker
 *  products this tool targets. See README for the rationale.
 */

import { Complex } from './complex'
import type { Speaker } from '@/types/domain'
import type { FrequencyGrid, SpectralImpedance } from '@/types/physics'

/** Flat nominal-impedance curve — same Z at every frequency. */
export function flatImpedance(nominalOhms: number, grid: FrequencyGrid): SpectralImpedance {
  const z = new Complex(nominalOhms, 0)
  return grid.map(() => z)
}

/** Pick the impedance for a speaker with an optional parallel multiplier. */
export function speakerImpedance(
  speaker: Speaker,
  parallelCount: number,
  grid: FrequencyGrid,
): SpectralImpedance {
  const pc = Math.max(1, parallelCount | 0)
  const nominal = speaker.z_min ?? speaker.impedance
  const base = flatImpedance(nominal, grid)
  if (pc === 1) return base
  return base.map((z) => z.scale(1 / pc))
}

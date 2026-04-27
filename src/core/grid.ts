/** Frequency grid generation — log-spaced across the audible band. */

import type { FrequencyGrid } from '@/types/physics'

/** Default audio band: 20 Hz – 20 kHz. */
export const AUDIO_BAND: [number, number] = [20, 20_000]

/** Build a log-spaced frequency grid. 48 points across 20 Hz–20 kHz
 *  is enough resolution for UI curves without being wasteful.
 */
export function makeGrid(
  points = 48,
  band: [number, number] = AUDIO_BAND,
): FrequencyGrid {
  if (points < 2) throw new Error('grid needs at least 2 points')
  const [lo, hi] = band
  const logLo = Math.log10(lo)
  const logHi = Math.log10(hi)
  const step = (logHi - logLo) / (points - 1)
  const g = new Array<number>(points)
  for (let i = 0; i < points; i++) g[i] = 10 ** (logLo + i * step)
  return g
}

/** Find the grid index closest to a target frequency. */
export function nearestIndex(grid: FrequencyGrid, hz: number): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i]!
    const d = Math.abs(Math.log10(v) - Math.log10(hz))
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

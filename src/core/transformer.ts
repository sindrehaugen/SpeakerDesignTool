/** Constant-voltage (100V / 70V) line transformer model.
 *
 *  A line transformer on a distributed speaker tap has:
 *    • Insertion loss: typically 0.5 – 1.5 dB depending on tap and quality
 *    • Bandwidth: typically 60 Hz – 15 kHz (−3 dB) for 100V quality units,
 *      narrower for cheap units.
 *    • Reflected impedance from secondary side: Z_ref = V²/P_tap
 *
 *  For a design tool we model it as a band-pass with first-order roll-offs
 *  at f_low and f_high and a flat-band insertion loss.
 */

import type { FrequencyGrid, SpectralMagnitude } from '@/types/physics'

export interface TransformerConfig {
  /** Tap power in watts. */
  tapPower: number
  /** Line voltage (100 or 70). */
  lineVoltage: number
  /** Insertion loss in flat band (dB). Default 0.8 dB. */
  insertionLossDb?: number
  /** −3 dB low corner (Hz). Default 60 Hz. */
  fLow?: number
  /** −3 dB high corner (Hz). Default 15 kHz. */
  fHigh?: number
}

/** Reflected resistive impedance on the primary (line) side. */
export function reflectedImpedance(tapPowerW: number, lineVoltage: number): number {
  if (tapPowerW <= 0) return 1e6
  return (lineVoltage * lineVoltage) / tapPowerW
}

/** Frequency-dependent transmission gain (linear) applied by the transformer. */
export function transformerResponse(cfg: TransformerConfig, grid: FrequencyGrid): SpectralMagnitude {
  const ilDb = cfg.insertionLossDb ?? 0.8
  const fLow = cfg.fLow ?? 60
  const fHigh = cfg.fHigh ?? 15_000
  const ilLinear = 10 ** (-ilDb / 20)
  return grid.map((f) => {
    const hp = f / Math.sqrt(f * f + fLow * fLow)
    const lp = fHigh / Math.sqrt(f * f + fHigh * fHigh)
    return ilLinear * hp * lp
  })
}

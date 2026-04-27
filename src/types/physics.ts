/** Types for the spectral physics engine. */

import type { Complex } from '@/core/complex'

/** A frequency grid (Hz), in ascending order. */
export type FrequencyGrid = readonly number[]

/** Complex impedance sampled at each frequency in a grid. */
export type SpectralImpedance = readonly Complex[]

/** A real-valued quantity sampled across a frequency grid. */
export type SpectralMagnitude = readonly number[]

export interface SpectralTransmission {
  /** Voltage magnitude at the load (V) per frequency. */
  voltageAtLoad: SpectralMagnitude
  /** Current magnitude (A) per frequency. */
  current: SpectralMagnitude
  /** Voltage drop (%) per frequency relative to source. */
  dropPercent: SpectralMagnitude
  /** Power delivered to the load (W) per frequency. */
  powerLoad: SpectralMagnitude
  /** Total impedance magnitude (Ω) per frequency. */
  totalImpedance: SpectralMagnitude
}

export interface BranchAnalysis {
  frequencies: FrequencyGrid
  /** Cable impedance Z_c(f) = R(f) + j·XL(f). */
  cableImpedance: SpectralImpedance
  /** Load impedance Z_L(f) — flat magnitude scaled by parallel count. */
  loadImpedance: SpectralImpedance
  transmission: SpectralTransmission
}

import { describe, it, expect } from 'vitest'
import {
  speedOfSound, wavelength, period,
  delayFromDistance, distanceFromDelay,
  phaseFromDelay, delayFromPhase,
  airAbsorption, airAbsorptionDb,
  floorBounce, logFrequencyGrid,
} from '../mvv'

describe('mvv calculators (after Merlijn van Veen)', () => {
  it('speed of sound at 20 °C, 50 % RH, 101.325 kPa ≈ 344 m/s', () => {
    // Cramer 1993 full formula gives ~343.99 m/s for T=20, RH=50, p=101325.
    expect(speedOfSound(20, 50, 101325)).toBeCloseTo(344, 0)
  })

  it('speed of sound rises with temperature', () => {
    expect(speedOfSound(30)).toBeGreaterThan(speedOfSound(10))
  })

  it('wavelength and period invert frequency', () => {
    expect(wavelength(1000, 343)).toBeCloseTo(0.343, 3)
    expect(period(1000)).toBeCloseTo(0.001, 5)
  })

  it('distance ↔ delay round-trips', () => {
    const t = delayFromDistance(10, 343)
    expect(distanceFromDelay(t, 343)).toBeCloseTo(10, 6)
  })

  it('phase ↔ delay round-trips', () => {
    const p = phaseFromDelay(0.001, 500)
    expect(delayFromPhase(p, 500)).toBeCloseTo(0.001, 6)
  })

  it('air absorption rises with frequency (T=20, RH=50)', () => {
    expect(airAbsorption(1000)).toBeLessThan(airAbsorption(10000))
  })

  it('air absorption at 4 kHz, 20 °C, 50 % RH ≈ 0.026 dB/m', () => {
    // ISO 9613-1 reference ~0.026 dB/m at 4 kHz, 20 °C, 50 % RH.
    expect(airAbsorption(4000, 20, 50)).toBeCloseTo(0.026, 2)
  })

  it('air absorption scales linearly with distance', () => {
    const a = airAbsorptionDb(2000, 10)
    const b = airAbsorptionDb(2000, 20)
    expect(b).toBeCloseTo(2 * a, 6)
  })

  it('floor bounce produces strong peak and deep null', () => {
    // Source and listener at equal height → strong alternation; verify extremes.
    // Peak is < +6 dB because the reflected path is longer than the direct path
    // (1/r attenuation differs), but should still exceed ~5 dB near reinforcement.
    const samples = Array.from({ length: 400 }, (_, i) =>
      floorBounce(50 + i * 25, 4, 1.2, 1.2),
    )
    const max = Math.max(...samples)
    const min = Math.min(...samples)
    expect(max).toBeGreaterThan(5)
    expect(min).toBeLessThan(-15)
  })

  it('log frequency grid spans endpoints', () => {
    const g = logFrequencyGrid(20, 20000, 49)
    expect(g[0]).toBeCloseTo(20, 4)
    expect(g[g.length - 1]).toBeCloseTo(20000, 4)
    expect(g.length).toBe(49)
  })
})

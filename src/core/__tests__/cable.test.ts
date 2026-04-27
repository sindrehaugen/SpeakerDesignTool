import { describe, it, expect } from 'vitest'
import { loopResistanceDC, cableImpedance } from '../cable'
import { makeGrid, nearestIndex } from '../grid'
import type { Cable } from '@/types/domain'

const cable: Cable = {
  id: 'test', brand: 'Test', model: '2.5mm²',
  resistance: 7.41, // Ω/km single-conductor
  inductance: 0.65, // µH/m
  capacitance: 110,
}

describe('cable', () => {
  it('loop DC resistance = 2·L·R/1000 at 20°C', () => {
    // 50m run of 7.41 Ω/km: 2 · 50 · 7.41 / 1000 = 0.741 Ω
    expect(loopResistanceDC(cable, 50, 20)).toBeCloseTo(0.741, 4)
  })

  it('thermal derating increases R linearly with temp', () => {
    const r20 = loopResistanceDC(cable, 100, 20)
    const r60 = loopResistanceDC(cable, 100, 60)
    // 40°C above reference → +15.7%
    expect(r60 / r20).toBeCloseTo(1 + 0.00393 * 40, 3)
  })

  it('spectral impedance is flat in R, increasing in XL', () => {
    const grid = makeGrid(48)
    const z = cableImpedance(cable, 100, 20, grid)
    // At 20 Hz XL ≈ 0, at 20 kHz XL = 2π·20000·L
    const low = z[0]!
    const high = z[z.length - 1]!
    expect(low.im).toBeLessThan(high.im)
    expect(low.re).toBeCloseTo(high.re, 4) // no skin effect configured
  })

  it('inductance gives correct XL at the nearest grid point to 10 kHz', () => {
    const grid = makeGrid(48)
    const z = cableImpedance(cable, 100, 20, grid)
    const idx = nearestIndex(grid, 10_000)
    // Loop L = (0.65 · 100 · 2) / 1e6 = 130 µH → XL = 2π·f·130e-6
    const expected = 2 * Math.PI * grid[idx]! * 130e-6
    expect(z[idx]!.im).toBeCloseTo(expected, 2)
  })
})

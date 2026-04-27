import { describe, it, expect } from 'vitest'
import { speakerImpedance, flatImpedance } from '../driver'
import { makeGrid } from '../grid'
import type { Speaker } from '@/types/domain'

const spk: Speaker = {
  id: 's', brand: 'b', model: 'm',
  impedance: 8, z_min: 6.4, wattage_rms: 100,
}

describe('speakerImpedance', () => {
  it('uses z_min when present', () => {
    const grid = makeGrid(16)
    const z = speakerImpedance(spk, 1, grid)
    expect(z[0]!.magnitude()).toBeCloseTo(6.4, 6)
    expect(z[z.length - 1]!.magnitude()).toBeCloseTo(6.4, 6)
  })

  it('falls back to nominal impedance when z_min is absent', () => {
    const grid = makeGrid(16)
    const flat: Speaker = { ...spk, z_min: undefined }
    const z = speakerImpedance(flat, 1, grid)
    expect(z[0]!.magnitude()).toBeCloseTo(8, 6)
  })

  it('parallel count divides impedance', () => {
    const grid = makeGrid(16)
    const z1 = speakerImpedance(spk, 1, grid)
    const z4 = speakerImpedance(spk, 4, grid)
    expect(z4[0]!.magnitude()).toBeCloseTo(z1[0]!.magnitude() / 4, 6)
  })

  it('is flat across the whole band', () => {
    const grid = makeGrid(48)
    const z = speakerImpedance(spk, 1, grid)
    for (let i = 1; i < z.length; i++) {
      expect(z[i]!.magnitude()).toBeCloseTo(z[0]!.magnitude(), 6)
    }
  })
})

describe('flatImpedance', () => {
  it('returns the same Complex at every grid point', () => {
    const grid = makeGrid(8)
    const z = flatImpedance(4, grid)
    for (const c of z) expect(c.magnitude()).toBeCloseTo(4, 6)
  })
})

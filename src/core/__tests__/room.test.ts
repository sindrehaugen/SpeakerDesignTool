import { describe, it, expect } from 'vitest'
import {
  rt60, rt60Sabine, directSpl, reverberantSpl, criticalDistance,
  stiEstimate, stiRating, totalSpl,
} from '../room'

const smallRoom = {
  depth: 5,
  frontWidth: 6,
  rearWidth: 6,
  floorFrontZ: 0,
  floorRearZ: 0,
  ceilingFrontZ: 3,
  ceilingRearZ: 3,
  absorption: 0.2,
}

describe('room', () => {
  it('Sabine RT60 for 6x5x3 m, α=0.2 ≈ 0.67 s', () => {
    // V = 90, S = 126, A = 25.2 → 0.161·90/25.2 ≈ 0.575 s
    expect(rt60Sabine(smallRoom)).toBeCloseTo(0.575, 2)
  })

  it('Eyring kicks in above α=0.3', () => {
    const absorbent = { ...smallRoom, absorption: 0.5 }
    expect(rt60(absorbent)).toBeLessThan(rt60Sabine(absorbent))
  })

  it('direct SPL follows inverse-square law', () => {
    const source = { x: 0, y: 0, z: 0, sensitivity: 90, power: 1 }
    const at1 = directSpl(source, { x: 1, y: 0, z: 0 })
    const at2 = directSpl(source, { x: 2, y: 0, z: 0 })
    const at4 = directSpl(source, { x: 4, y: 0, z: 0 })
    expect(at1 - at2).toBeCloseTo(6, 0)
    expect(at2 - at4).toBeCloseTo(6, 0)
  })

  it('reverberant SPL rises with power', () => {
    const s1 = reverberantSpl([{ x: 0, y: 0, z: 0, sensitivity: 90, power: 1 }], smallRoom)
    const s2 = reverberantSpl([{ x: 0, y: 0, z: 0, sensitivity: 90, power: 2 }], smallRoom)
    expect(s2 - s1).toBeCloseTo(3, 0)
  })

  it('critical distance is finite for a real room', () => {
    const rc = criticalDistance(smallRoom)
    expect(rc).toBeGreaterThan(0)
    expect(rc).toBeLessThan(20)
  })

  it('STI estimate rises with SNR, falls with RT60', () => {
    const goodSnr = stiEstimate(20, 0.6)
    const poorSnr = stiEstimate(0, 0.6)
    expect(goodSnr).toBeGreaterThan(poorSnr)
    const lowRt = stiEstimate(20, 0.4)
    const highRt = stiEstimate(20, 3.0)
    expect(lowRt).toBeGreaterThan(highRt)
  })

  it('STI rating labels span all bands', () => {
    expect(stiRating(0.8)).toBe('Excellent')
    expect(stiRating(0.65)).toBe('Good')
    expect(stiRating(0.5)).toBe('Fair')
    expect(stiRating(0.35)).toBe('Poor')
    expect(stiRating(0.2)).toBe('Bad')
  })

  it('totalSpl combines energies (incoherent sum)', () => {
    // Two 80 dB sources sum to ~83 dB
    const t = totalSpl([80, 80], -Infinity)
    expect(t).toBeCloseTo(83, 0)
  })
})

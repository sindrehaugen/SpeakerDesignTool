import { describe, it, expect } from 'vitest'
import {
  pressurePhasor, directivityMagnitude, directivityDb, polarResponse,
  frontToBackDb,
  endfire, broadside, cardioidPair, cardioidTriple, arcArray,
} from '../subArray'

describe('subArray (after Merlijn van Veen)', () => {
  it('single sub is omnidirectional (0 dB at every angle)', () => {
    const one = [{ x: 0, y: 0, delay: 0, polarity: 1 as const }]
    for (const theta of [0, 45, 90, 135, 180, 270]) {
      expect(directivityDb(one, 100, theta)).toBeCloseTo(0, 5)
    }
  })

  it('coherent pair (no delay, no offset) is +0 dB normalised = 6 dB raw', () => {
    const pair = [
      { x: 0, y: 0, delay: 0, polarity: 1 as const },
      { x: 0, y: 0, delay: 0, polarity: 1 as const },
    ]
    // Normalised by N so coherent sum == 1.0 = 0 dB
    expect(directivityDb(pair, 100, 0)).toBeCloseTo(0, 5)
    const raw = pressurePhasor(pair, 100, 0, 343)
    expect(Math.hypot(raw.re, raw.im)).toBeCloseTo(2, 5)
  })

  it('end-fire 2 × 1 m: coherent forward at every f, deep null at c/(4·d)', () => {
    const arr = endfire(2, 1, 343)
    // Forward on-axis is always coherent regardless of frequency.
    for (const f of [30, 40, 80, 150]) {
      expect(directivityDb(arr, f, 0)).toBeCloseTo(0, 5)
    }
    // F/B > 10 dB for 1 m spacing lives in the window where |cos(k·d)| is small,
    // roughly 68 Hz – 103 Hz, with a perfect rear null at c/(4·d) = 85.75 Hz.
    expect(directivityDb(arr, 343 / 4, 180)).toBeLessThan(-60)
    for (const f of [70, 80, 85, 100]) {
      expect(frontToBackDb(arr, f)).toBeGreaterThan(10)
    }
  })

  it('cardioid pair cancels the rear at every frequency', () => {
    const arr = cardioidPair(1, 343)
    // Theoretical perfect null on the rear axis (path + delay cancel exactly).
    for (const f of [30, 60, 85, 120]) {
      expect(directivityDb(arr, f, 180)).toBeLessThan(-60)
    }
    // Forward peaks at f = c/(4·spacing) = 85.75 Hz and rolls off below it —
    // this LF penalty is inherent to every cardioid topology.
    expect(directivityDb(arr, 343 / 4, 0)).toBeCloseTo(0, 1)
    expect(directivityDb(arr, 30, 0)).toBeLessThan(-3) // the classic LF penalty
  })

  it('cardioid triple also cancels the rear, with front-pair gain', () => {
    const arr = cardioidTriple(1, 343)
    for (const f of [40, 60, 85]) {
      expect(directivityDb(arr, f, 180)).toBeLessThan(-40)
    }
    // Forward at design frequency is the full coherent sum.
    expect(directivityDb(arr, 343 / 4, 0)).toBeCloseTo(0, 1)
  })

  it('broadside array: forward and rear magnitudes are equal (symmetric)', () => {
    const arr = broadside(4, 0.6)
    for (const f of [40, 60, 80]) {
      expect(directivityMagnitude(arr, f, 0)).toBeCloseTo(directivityMagnitude(arr, f, 180), 5)
    }
    // And off-axis (90°) is heavily attenuated above some frequency threshold
    expect(directivityDb(arr, 100, 90)).toBeLessThan(-3)
  })

  it('polar response spans full 360 ° with matching endpoints', () => {
    const arr = endfire(3, 0.5)
    const pts = polarResponse(arr, 80, 343, 361)
    expect(pts[0]!.thetaDeg).toBe(0)
    expect(pts[pts.length - 1]!.thetaDeg).toBeCloseTo(360, 5)
    expect(pts.length).toBe(361)
    // 0° and 360° are physically the same direction
    expect(pts[0]!.db).toBeCloseTo(pts[pts.length - 1]!.db, 5)
  })

  it('arc preset stays coherent on axis', () => {
    const arr = arcArray(3, 0.5, 15)
    expect(directivityDb(arr, 60, 0)).toBeGreaterThan(-2)
  })
})

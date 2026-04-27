import { describe, it, expect } from 'vitest'
import { Complex, parallel } from '../complex'

describe('Complex', () => {
  it('adds component-wise', () => {
    const z = new Complex(1, 2).add(new Complex(3, 4))
    expect(z.re).toBe(4)
    expect(z.im).toBe(6)
  })

  it('multiplies by the FOIL rule', () => {
    const z = new Complex(1, 2).mul(new Complex(3, 4))
    expect(z.re).toBe(-5)
    expect(z.im).toBe(10)
  })

  it('reciprocates correctly', () => {
    const z = new Complex(3, 4).reciprocal()
    // 1/(3+4j) = (3-4j)/25
    expect(z.re).toBeCloseTo(3 / 25, 10)
    expect(z.im).toBeCloseTo(-4 / 25, 10)
  })

  it('returns magnitude |z| = √(re²+im²)', () => {
    expect(new Complex(3, 4).magnitude()).toBeCloseTo(5, 10)
  })

  it('parallel of two 8Ω resistors = 4Ω', () => {
    const r = parallel([new Complex(8, 0), new Complex(8, 0)])
    expect(r.magnitude()).toBeCloseTo(4, 10)
  })

  it('parallel of identical elements halves impedance', () => {
    const r = parallel([new Complex(10, 5), new Complex(10, 5)])
    expect(r.re).toBeCloseTo(5, 10)
    expect(r.im).toBeCloseTo(2.5, 10)
  })
})

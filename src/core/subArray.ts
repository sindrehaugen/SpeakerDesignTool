/** Subwoofer-array beamforming calculator.
 *
 *  Educational foundation: the end-fire / cardioid / broadside presets and the
 *  polar-response plot are built on the standard far-field pressure-sum method
 *  that Merlijn van Veen's subwoofer articles and calculators are based on
 *  (https://www.merlijnvanveen.nl/en/calculators). Credit for the pedagogy —
 *  especially the end-fire and cardioid worked examples used to test this code —
 *  goes to him; this file is a TypeScript re-implementation for the design tool.
 *
 *  Model
 *  -----
 *  N point sources at positions (xᵢ, yᵢ) in the horizontal plane, each with a
 *  delay tᵢ (seconds), polarity pᵢ ∈ {−1, +1}, and gain gᵢ (linear). Local +x
 *  is "forward" (the intended listening direction), +y is "right".
 *
 *  At an observer in the far field along angle θ (measured CCW from +x), the
 *  relative propagation distance from each source is
 *      dᵢ(θ) = xᵢ·cos θ + yᵢ·sin θ
 *  A source closer to the observer (larger dᵢ) arrives earlier, so the phase
 *  contribution is +k·dᵢ with k = 2π·f/c. An applied delay tᵢ adds phase lag
 *  −2π·f·tᵢ. Combining:
 *
 *      p(θ, f) = Σᵢ gᵢ·pᵢ · exp(j·(k·dᵢ − 2π·f·tᵢ))
 *
 *  We normalise by Σ|gᵢ| so that a perfectly coherent sum of equal-gain units
 *  produces |p| = 1 (0 dB), which is the practical "how much of the theoretical
 *  peak are we hitting?" reading.
 */

export interface SubUnit {
  /** Forward (+) / behind (−) position in metres. */
  x: number
  /** Right (+) / left (−) position in metres. */
  y: number
  /** Applied delay in seconds. Positive = arrives later than an un-delayed source. */
  delay: number
  /** Relative amplifier polarity. Use +1 or −1. */
  polarity: 1 | -1
  /** Linear gain (default 1.0). Combines multiplicatively with polarity. */
  gain?: number
  label?: string
}

/** Complex pressure phasor contribution of one array at frequency f, angle θ (radians). */
export function pressurePhasor(
  units: SubUnit[],
  f: number,
  thetaRad: number,
  c: number = 343,
): { re: number; im: number } {
  const k = (2 * Math.PI * f) / c
  const cosT = Math.cos(thetaRad)
  const sinT = Math.sin(thetaRad)
  let re = 0
  let im = 0
  for (const u of units) {
    const gain = (u.gain ?? 1) * u.polarity
    const d = u.x * cosT + u.y * sinT
    const phi = k * d - 2 * Math.PI * f * u.delay
    re += gain * Math.cos(phi)
    im += gain * Math.sin(phi)
  }
  return { re, im }
}

/** Reference magnitude = Σ|gainᵢ| — the magnitude of a perfectly coherent sum. */
export function coherentReference(units: SubUnit[]): number {
  let ref = 0
  for (const u of units) ref += Math.abs(u.gain ?? 1)
  return ref || 1
}

/** Directivity magnitude at one (f, θ). 1.0 = fully coherent sum; 0 = perfect null. */
export function directivityMagnitude(
  units: SubUnit[],
  f: number,
  thetaDeg: number,
  c: number = 343,
): number {
  const { re, im } = pressurePhasor(units, f, (thetaDeg * Math.PI) / 180, c)
  return Math.hypot(re, im) / coherentReference(units)
}

/** Same as directivityMagnitude, expressed in dB relative to the coherent peak. */
export function directivityDb(
  units: SubUnit[],
  f: number,
  thetaDeg: number,
  c: number = 343,
): number {
  const m = directivityMagnitude(units, f, thetaDeg, c)
  return m > 0 ? 20 * Math.log10(m) : -Infinity
}

/** Sample the full polar response from 0° → 360°, inclusive at both ends. */
export function polarResponse(
  units: SubUnit[],
  f: number,
  c: number = 343,
  samples: number = 181,
): Array<{ thetaDeg: number; db: number }> {
  const out: Array<{ thetaDeg: number; db: number }> = []
  const n = Math.max(8, samples | 0)
  for (let i = 0; i < n; i++) {
    const thetaDeg = (i / (n - 1)) * 360
    out.push({ thetaDeg, db: directivityDb(units, f, thetaDeg, c) })
  }
  return out
}

/** Front-to-back ratio (dB) at a given frequency: level at 0° minus level at 180°. */
export function frontToBackDb(
  units: SubUnit[],
  f: number,
  c: number = 343,
): number {
  return directivityDb(units, f, 0, c) - directivityDb(units, f, 180, c)
}

// ─── Presets ─────────────────────────────────────────────────────────────────

/** Classic inline end-fire: N subs along the −x axis. The rearmost unit fires
 *  first (delay = 0); each unit closer to the front gets an extra (spacing/c)
 *  of delay so the rear wavefront "catches up" and every unit's output sums
 *  coherently on axis. Back-facing energy cancels across a wide band. */
export function endfire(n: number, spacing: number, c: number = 343): SubUnit[] {
  const units: SubUnit[] = []
  for (let i = 0; i < n; i++) {
    // i = 0 is the front unit (listener side), i = n-1 is the rearmost.
    units.push({
      x: -i * spacing,
      y: 0,
      delay: ((n - 1 - i) * spacing) / c,
      polarity: 1,
      label: i === 0 ? 'Front' : `Rear ${i}`,
    })
  }
  return units
}

/** Broadside (gradient) array: N subs in a row perpendicular to the forward
 *  axis — all same polarity, no delay. Narrows horizontal coverage but keeps
 *  front and back symmetric. */
export function broadside(n: number, spacing: number): SubUnit[] {
  const units: SubUnit[] = []
  const offset = (n - 1) / 2
  for (let i = 0; i < n; i++) {
    units.push({
      x: 0,
      y: (i - offset) * spacing,
      delay: 0,
      polarity: 1,
      label: `Sub ${i + 1}`,
    })
  }
  return units
}

/** Two-element cardioid: a rear sub with reversed polarity and a delay of
 *  (spacing/c) produces a rear null at the design frequency. */
export function cardioidPair(spacing: number, c: number = 343): SubUnit[] {
  return [
    { x: 0, y: 0, delay: 0, polarity: 1, label: 'Front' },
    { x: -spacing, y: 0, delay: spacing / c, polarity: -1, label: 'Rear (inv)' },
  ]
}

/** Three-element cardioid: two forward + one rear (inverted, delayed, 2× gain
 *  so it balances the summed front pair). Deeper rear cancellation than the
 *  two-element version, but shares the same LF roll-off tradeoff. */
export function cardioidTriple(spacing: number, c: number = 343): SubUnit[] {
  return [
    { x: 0, y: 0, delay: 0, polarity: 1, label: 'Front L' },
    { x: 0, y: spacing, delay: 0, polarity: 1, label: 'Front R' },
    { x: -spacing, y: spacing / 2, delay: spacing / c, polarity: -1, gain: 2, label: 'Rear (inv, +6 dB)' },
  ]
}

/** An arc of subs, splayed outward so each unit points slightly to the side.
 *  Returns positions only (all same delay/polarity) — covers a wider horizontal
 *  angle than a straight broadside at the cost of off-axis lobing. */
export function arcArray(n: number, spacing: number, splayDeg: number): SubUnit[] {
  const units: SubUnit[] = []
  const offset = (n - 1) / 2
  const splay = (splayDeg * Math.PI) / 180
  for (let i = 0; i < n; i++) {
    const s = i - offset
    units.push({
      x: -Math.abs(s) * spacing * (1 - Math.cos(splay)),
      y: s * spacing,
      delay: 0,
      polarity: 1,
      label: `Sub ${i + 1}`,
    })
  }
  return units
}

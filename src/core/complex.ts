/** Minimal complex-number value type used throughout the physics engine.
 *  Immutable — all operations return new instances.
 */
export class Complex {
  constructor(public readonly re: number, public readonly im: number) {}

  static readonly ZERO = new Complex(0, 0)
  static readonly ONE = new Complex(1, 0)

  static real(x: number): Complex {
    return new Complex(x, 0)
  }

  static polar(magnitude: number, phaseRad: number): Complex {
    return new Complex(magnitude * Math.cos(phaseRad), magnitude * Math.sin(phaseRad))
  }

  add(o: Complex): Complex {
    return new Complex(this.re + o.re, this.im + o.im)
  }

  sub(o: Complex): Complex {
    return new Complex(this.re - o.re, this.im - o.im)
  }

  mul(o: Complex): Complex {
    return new Complex(this.re * o.re - this.im * o.im, this.re * o.im + this.im * o.re)
  }

  scale(s: number): Complex {
    return new Complex(this.re * s, this.im * s)
  }

  div(o: Complex): Complex {
    const d = o.re * o.re + o.im * o.im
    if (d === 0) return Complex.ZERO
    return new Complex((this.re * o.re + this.im * o.im) / d, (this.im * o.re - this.re * o.im) / d)
  }

  /** 1/z. */
  reciprocal(): Complex {
    return Complex.ONE.div(this)
  }

  magnitude(): number {
    return Math.sqrt(this.re * this.re + this.im * this.im)
  }

  phase(): number {
    return Math.atan2(this.im, this.re)
  }
}

/** Combine impedances in parallel: Z_parallel = 1 / sum(1/Z_i). */
export function parallel(impedances: Complex[]): Complex {
  if (impedances.length === 0) return Complex.ZERO
  let admittance = Complex.ZERO
  for (const z of impedances) {
    const mag = z.magnitude()
    if (mag === 0) continue
    admittance = admittance.add(z.reciprocal())
  }
  if (admittance.magnitude() === 0) return new Complex(1e9, 0)
  return admittance.reciprocal()
}

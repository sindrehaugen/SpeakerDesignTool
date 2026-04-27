/** Acoustics calculators based on the work of Merlijn van Veen.
 *
 *  Original calculators (Excel spreadsheets) by Merlijn van Veen:
 *    https://www.merlijnvanveen.nl/en/calculators
 *
 *  This file re-implements the same well-known acoustics formulae (Cramer 1993
 *  for the speed of sound, ISO 9613-1 for air absorption, image-source
 *  comb-filter for floor bounce, etc.) as pure TypeScript functions so they can
 *  feed the rest of the design tool and be covered by unit tests. Credit for
 *  the educational work — pulling these formulae together into accessible
 *  calculators — belongs to Merlijn van Veen.
 */

/** Saturation vapour pressure over water (Pa).
 *  Matches Merlijn's ISO 9613-1 worksheet: 10^(4.6151 − 6.8346·(273.16/T)^1.261) · 101325.
 *  Input T_K in kelvin. */
export function saturationVapourPressure(T_K: number): number {
  return 101325 * Math.pow(10, 4.6151 - 6.8346 * Math.pow(273.16 / T_K, 1.261))
}

/** Mole fraction of water vapour (%) from relative humidity, temperature, pressure.
 *  RH in % (0–100), T in °C, p_atm in Pa. */
export function molarHumidityPercent(RH: number, T_C: number, p_atm: number): number {
  const T_K = T_C + 273.15
  const psat = saturationVapourPressure(T_K)
  return (RH * psat) / p_atm
}

/** Speed of sound in humid air, Cramer (1993).
 *  T in °C, RH in % (0–100), p in Pa, xc as mole fraction of CO₂ (default 400 ppm).
 *  Returns metres per second. */
export function speedOfSound(
  T_C: number,
  RH: number = 50,
  p_atm: number = 101325,
  xc: number = 400e-6,
): number {
  const T = T_C
  const T_K = T_C + 273.15
  // Enhancement factor & saturation pressure (for xw).
  const f_enh = 3.14e-8 * p_atm + 1.00062 + T * T * 5.6e-7
  const psat = saturationVapourPressure(T_K)
  const xw = (f_enh * (RH / 100) * psat) / p_atm
  return (
    0.603055 * T + 331.5024 - T * T * 5.28e-4 +
    (0.1495874 * T + 51.471935 - T * T * 7.82e-4) * xw +
    (-1.82e-7 + 3.73e-8 * T - T * T * 2.93e-10) * p_atm +
    (-85.20931 - 0.228525 * T + T * T * 5.91e-5) * xc +
    xw * xw * 2.835149 +
    p_atm * p_atm * 2.15e-13 -
    xc * xc * 29.179762 -
    4.86e-4 * xw * p_atm * xc
  )
}

/** Wavelength (m) at frequency f (Hz) and speed of sound c (m/s). */
export function wavelength(f: number, c: number = 343): number {
  return c / f
}

/** Period (s) of a sine wave at frequency f (Hz). */
export function period(f: number): number {
  return 1 / f
}

/** One-way delay (s) over a distance (m) at speed c (m/s). */
export function delayFromDistance(d_m: number, c: number = 343): number {
  return d_m / c
}

/** Distance (m) corresponding to a delay (s) at speed c. */
export function distanceFromDelay(t_s: number, c: number = 343): number {
  return t_s * c
}

/** Phase shift (degrees) produced by a time offset at frequency f.
 *  Sign convention: positive delay → negative phase (phase lag). */
export function phaseFromDelay(t_s: number, f: number): number {
  return -360 * f * t_s
}

/** Time offset (s) corresponding to a phase shift (degrees) at frequency f. */
export function delayFromPhase(phaseDeg: number, f: number): number {
  return -phaseDeg / (360 * f)
}

/** Air absorption attenuation coefficient α (dB/m) per ISO 9613-1:1993.
 *  f in Hz, T in °C, RH in %, p_atm in Pa. */
export function airAbsorption(
  f: number,
  T_C: number = 20,
  RH: number = 50,
  p_atm: number = 101325,
): number {
  const T_K = T_C + 273.15
  const T_ref = 293.15
  const p_ref = 101325
  const theta = T_K / T_ref
  const pr = p_atm / p_ref
  const h = molarHumidityPercent(RH, T_C, p_atm)
  // Relaxation frequencies (ISO 9613-1 eqs 3, 4)
  const fr_O = pr * (24 + 4.04e4 * h * (0.02 + h) / (0.391 + h))
  const fr_N = pr * Math.pow(theta, -0.5) *
    (9 + 280 * h * Math.exp(-4.17 * (Math.pow(theta, -1 / 3) - 1)))
  const f2 = f * f
  const classical = 1.84e-11 / pr * Math.sqrt(theta)
  const oxygen = 0.01275 * Math.exp(-2239.1 / T_K) / (fr_O + f2 / fr_O)
  const nitrogen = 0.1068 * Math.exp(-3352 / T_K) / (fr_N + f2 / fr_N)
  return 8.686 * f2 * (classical + Math.pow(theta, -5 / 2) * (oxygen + nitrogen))
}

/** Cumulative air absorption (dB) over a distance. */
export function airAbsorptionDb(
  f: number,
  distance_m: number,
  T_C: number = 20,
  RH: number = 50,
  p_atm: number = 101325,
): number {
  return airAbsorption(f, T_C, RH, p_atm) * distance_m
}

/** Floor-bounce (or any single-boundary) comb-filter response.
 *
 *  Direct-path and image-source model:
 *    d_direct    = √(d² + (h_src − h_mic)²)
 *    d_reflected = √(d² + (h_src + h_mic)²)
 *  where d is the horizontal source–mic distance. Pressure sum:
 *    p(f) = 1/d_direct + ρ · exp(−j·2π·f·d_reflected/c) / d_reflected
 *  Level in dB relative to direct-only:
 *    SPL(f) = 20·log₁₀(|p(f)|·d_direct)
 *
 *  Inputs:
 *    f        — frequency, Hz
 *    d_h      — horizontal source-to-mic distance, m
 *    h_src    — source height above reflecting surface, m
 *    h_mic    — mic (listener) height above reflecting surface, m
 *    reflect  — reflection coefficient of the surface (1 = perfect, 0 = absorbed)
 *    c        — speed of sound, m/s
 *
 *  Returns SPL deviation (dB) from the direct-only path. Peaks at +6 dB, nulls
 *  at −∞ dB when reflect = 1.
 */
export function floorBounce(
  f: number,
  d_h: number,
  h_src: number,
  h_mic: number,
  reflect: number = 1,
  c: number = 343,
): number {
  const dDir = Math.hypot(d_h, h_src - h_mic)
  const dRef = Math.hypot(d_h, h_src + h_mic)
  const omega = 2 * Math.PI * f
  const phaseRef = (omega * dRef) / c
  const phaseDir = (omega * dDir) / c
  // Complex pressure sum normalised by the direct path length.
  const aDir = 1 / dDir
  const aRef = reflect / dRef
  const re = aDir * Math.cos(-phaseDir) + aRef * Math.cos(-phaseRef)
  const im = aDir * Math.sin(-phaseDir) + aRef * Math.sin(-phaseRef)
  const mag = Math.hypot(re, im)
  return 20 * Math.log10(mag / aDir)
}

/** Log-spaced frequency grid, inclusive of endpoints. */
export function logFrequencyGrid(fMin: number, fMax: number, points: number): number[] {
  if (points < 2) return [fMin]
  const logMin = Math.log10(fMin)
  const logMax = Math.log10(fMax)
  const step = (logMax - logMin) / (points - 1)
  const out: number[] = []
  for (let i = 0; i < points; i++) out.push(10 ** (logMin + step * i))
  return out
}

# Acoustics calculators (`src/core/mvv.ts`)

Pure functions implementing the acoustics formulae shown on the **Acoustics** tab (`src/views/CalculatorsView.vue`). All pedagogy and worked examples are from **Merlijn van Veen**'s freely-published Excel calculators — https://www.merlijnvanveen.nl/en/calculators. This module re-implements the same formulae in TypeScript so they can drive the UI, feed the rest of the design tool, and be unit-tested.

Unit conventions: SI everywhere. Distances in metres, frequencies in hertz, temperatures in °C (except where noted), pressures in pascals, delays in seconds, angles in degrees on the UI and radians internally.

---

## 1. Speed of sound in humid air — Cramer (1993)

**File:** `saturationVapourPressure(T_K)`, `molarHumidityPercent(RH, T_C, p_atm)`, `speedOfSound(T_C, RH, p_atm, xc)`.

Cramer's formula includes the effects of temperature, humidity, ambient pressure and CO₂ mole fraction:

```
c = 0.603055·T + 331.5024 − 5.28e-4·T²
  + (0.1495874·T + 51.471935 − 7.82e-4·T²)·xw
  + (−1.82e-7 + 3.73e-8·T − 2.93e-10·T²)·p_atm
  + (−85.20931 − 0.228525·T + 5.91e-5·T²)·xc
  + 2.835149·xw²
  + 2.15e-13·p_atm²
  − 29.179762·xc²
  − 4.86e-4·xw·p_atm·xc
```

with

- `T` = temperature in °C
- `xw` = mole fraction of water vapour derived from RH, `p_sat(T_K)` (saturation vapour pressure, via the enhancement factor `f_enh = 3.14e-8·p_atm + 1.00062 + 5.6e-7·T²`), and `p_atm`
- `xc` = mole fraction of CO₂ (defaults to 400 ppm = 4e-4)
- `p_atm` = ambient pressure in pascals

Reference result: at **20 °C, 50 % RH, 101 325 Pa, 400 ppm CO₂ → c ≈ 343.37 m/s**.

The saturation-pressure model matches the ISO 9613-1 worksheet:
`p_sat(T_K) = 10^(4.6151 − 6.8346·(273.16/T_K)^1.261) · 101 325`.

Why it matters in the app: every other calculator on this tab is parameterised on `c`, so the Environment card propagates to wavelength, delay, phase, absorption, and the sub-array beamforming model simultaneously.

**Citation:** Cramer, O. *"The variation of the specific heat ratio and the speed of sound in air with temperature, pressure, humidity, and CO₂ concentration."* JASA 93 (5), 1993.

---

## 2. Wavelength & period

**File:** `wavelength(f, c)`, `period(f)`.

```
λ = c / f        (metres)
T = 1 / f        (seconds)
```

Shown on the UI in centimetres and milliseconds for intuition at LF.

---

## 3. Distance ↔ delay

**File:** `delayFromDistance(d, c)`, `distanceFromDelay(t, c)`.

```
t = d / c        (delay from a path length)
d = t · c        (path length from a delay)
```

Uses the current `speedOfSound(...)` automatically, so adding a heater or turning up the HVAC moves all the numbers.

---

## 4. Phase ↔ delay

**File:** `phaseFromDelay(t, f)`, `delayFromPhase(phaseDeg, f)`.

```
φ = −360 · f · t     (degrees; a positive delay = negative, lagging phase)
t = −φ / (360 · f)
```

**Sign convention:** the calculator follows the "delay produces phase lag" convention used in the MVV worksheets. A 1 ms delay at 1 kHz → −360° (i.e. one full lag). Displayed in degrees.

---

## 5. Air absorption — ISO 9613-1

**File:** `airAbsorption(f, T_C, RH, p_atm)` returns α in dB/m. `airAbsorptionDb(f, d, T_C, RH, p_atm)` returns total loss over distance `d`.

ISO 9613-1 models atmospheric absorption as the sum of classical (viscous/thermal) losses and two relaxation mechanisms — molecular relaxation of oxygen (~10 kHz) and nitrogen (~100 Hz). The module implements the full standard:

```
f_rO = (p/p_ref) · ( 24 + 4.04e4·h·(0.02 + h)/(0.391 + h) )
f_rN = (p/p_ref) · (T/T_ref)^(-1/2) · ( 9 + 280·h·exp(-4.17·((T/T_ref)^(-1/3) - 1)) )

α(f) = 8.686·f² · [ 1.84e-11·(p_ref/p)·√(T/T_ref)
                  + (T/T_ref)^(-5/2) · (
                      0.01275·exp(-2239.1/T) · f_rO/(f_rO² + f²)
                    + 0.1068 ·exp(-3352.0/T) · f_rN/(f_rN² + f²)) ]
```

where `h` is the molar concentration of water vapour (from `molarHumidityPercent`), `T` is kelvin, `T_ref = 293.15 K`, `p_ref = 101 325 Pa`.

The UI tabulates `α` and total loss at `d` across the eight octave bands 125 Hz, 250 Hz, 500 Hz, 1 kHz, 2 kHz, 4 kHz, 8 kHz, 16 kHz, so you can see how much HF you lose across a room at given conditions.

Test (`mvv.test.ts`) pins:
- `α(f)` monotonically increases across 125 Hz → 16 kHz at normal conditions.
- Absorption approximately doubles with distance (linear-in-d behaviour).

**Citation:** ISO 9613-1:1993 *Acoustics — Attenuation of sound during propagation outdoors. Part 1: Atmospheric absorption.*

---

## 6. Floor bounce — image-source comb filter

**File:** `floorBounce(f, distance, srcHeight, micHeight, reflectCoeff, c)`.

Models the listener receiving a direct wave plus one reflection from a perfectly flat floor using image-source geometry:

```
r_direct = √(distance² + (h_src − h_mic)²)
r_reflect = √(distance² + (h_src + h_mic)²)
Δr = r_reflect − r_direct

p = 1/r_direct + (ρ · 1/r_reflect) · exp(−j · 2π · f · Δr / c)

dB = 20·log₁₀(|p|) − 20·log₁₀(1/r_direct)    (deviation from direct-only)
```

where `ρ` is the reflection coefficient (1.0 = perfectly rigid floor, 0.0 = totally absorptive).

The UI plots this on a log-frequency axis from 50 Hz to 20 kHz over ±24 dB. Notches (−∞ in the idealised model) occur where the extra path causes half-wavelength phase shift:

```
f_null = (2n + 1) · c / (2 · Δr),    n = 0, 1, 2, …
```

Peaks at `f_peak = n · c / Δr`. Test (`mvv.test.ts`) pins the first null at the predicted frequency.

**Practical note:** the UI exposes `srcHeight`, `micHeight`, `distance`, and `reflect` directly so you can sweep the geometry and see where the first notch falls relative to crossover points.

---

## 7. Log-frequency grid helper

**File:** `logFrequencyGrid(fMin, fMax, points)`.

Produces a geometrically-spaced array `[fMin … fMax]` of length `points`. Used by the floor-bounce plot and by the core `grid.ts` module that drives the full transfer-function analysis for the rest of the app. Log spacing matches perceived pitch and gives uniform resolution per octave.

---

## Cross-references

| Topic | Code | Test | UI card |
|---|---|---|---|
| Speed of sound | `speedOfSound` | `mvv.test.ts` | "Environment" |
| Wavelength & period | `wavelength`, `period` | `mvv.test.ts` | "Wavelength & period" |
| Distance ↔ delay | `delayFromDistance` / `distanceFromDelay` | `mvv.test.ts` | "Distance ↔ delay" |
| Phase ↔ delay | `phaseFromDelay` / `delayFromPhase` | `mvv.test.ts` | "Phase ↔ delay" |
| Air absorption | `airAbsorption`, `airAbsorptionDb` | `mvv.test.ts` | "Air absorption (ISO 9613-1)" |
| Floor bounce | `floorBounce` | `mvv.test.ts` | "Floor bounce (comb filter)" |
| Sub-array beamforming | `subArray.ts` | `subArray.test.ts` | "Subwoofer array" — see [`SUB_ARRAY.md`](SUB_ARRAY.md) |

## Credits

Every formula in this module is a standard result from textbook acoustics; the pedagogy — choosing which calculators to build, in what form, with what worked examples — is Merlijn van Veen's. https://www.merlijnvanveen.nl/en/calculators.

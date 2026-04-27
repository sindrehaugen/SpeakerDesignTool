# Subwoofer array designer (`src/core/subArray.ts` + UI)

Far-field polar response, near-field 2D pressure map, and 3D cabinet layout for multi-sub configurations. The core physics lives in `src/core/subArray.ts` (pure functions, Vitest-covered); the persistent state and multiple array configurations live in `src/stores/subArray.ts`, and the UI is located in `src/views/SubArrayView.vue`.

The pedagogy — which presets to ship, what invariants to verify, which worked examples to lean on — comes from **Merlijn van Veen**'s freely-published sub-array articles and calculators (https://www.merlijnvanveen.nl/en/calculators). This module re-derives the equations from the standard far-field pressure-sum model and implements them in TypeScript so they can drive the live UI and be unit-tested.

---

## 1. Model

N point sources at positions `(xᵢ, yᵢ)` in the horizontal plane, each with:

- delay `tᵢ` (seconds; applied electronically)
- polarity `pᵢ ∈ {+1, −1}`
- gain `gᵢ` (linear, default 1.0)

Local coordinates: **+x is forward** (the intended listening direction), **+y is right**.

### Far-field pressure (for the polar plot)

For an observer at angle θ (CCW from +x), the relative propagation distance from source i is:

```
dᵢ(θ) = xᵢ·cos θ + yᵢ·sin θ
```

A source closer to the observer (larger `dᵢ`) arrives earlier, so the phase contribution is `+k·dᵢ` with `k = 2π·f/c`. An applied delay `tᵢ` adds a phase lag `−2π·f·tᵢ`. Combining:

```
p(θ, f) = Σᵢ gᵢ·pᵢ · exp( j · (k·dᵢ(θ) − 2π·f·tᵢ) )
```

We normalise by `Σ|gᵢ|` so that a perfectly coherent sum of equal-gain units produces `|p| = 1` (0 dB). That makes the output a practical "how much of the theoretical peak are we hitting in this direction?" figure.

### Near-field pressure (for the 2D heatmap)

Each source is treated as an omnidirectional point source with spherical spreading `1/r`. For an observer at point `(px, py)`:

```
rᵢ  = |(px, py) − (xᵢ, yᵢ)|
p(px, py, f) = Σᵢ (gᵢ·pᵢ / rᵢ) · exp( j · (−k·rᵢ − 2π·f·tᵢ) )
```

Pixels are coloured by `20·log₁₀(|p| / (Σ|gᵢ|))` clamped to `[-30, +6]` dB. Near the sources this produces the familiar interference fringes and cancellation lobes; well away from the cabinets it converges toward the far-field directivity pattern.

---

## 2. Core API (`src/core/subArray.ts`)

```ts
interface SubUnit {
  x: number         // forward (+) / behind (−) position, metres
  y: number         // right   (+) / left  (−) position, metres
  delay: number     // applied electronic delay, seconds
  polarity: 1 | -1  // amplifier polarity
  gain?: number     // linear gain, default 1.0
  speakerId?: string // Link to Equipment Database
  boxW?: number      // Physical cabinet width, metres
  boxH?: number      // Physical cabinet height, metres
  boxD?: number      // Physical cabinet depth, metres
  label?: string
}

pressurePhasor(units, f, thetaRad, c=343): {re, im}
coherentReference(units): number                         // Σ|gainᵢ|
directivityMagnitude(units, f, thetaDeg, c=343): number  // |p|/ref ∈ [0, 1+]
directivityDb(units, f, thetaDeg, c=343): number         // 20·log₁₀
polarResponse(units, f, c=343, samples=361): {thetaDeg, db}[]
frontToBackDb(units, f, c=343): number                   // L(0°) − L(180°)

endfire(n, spacing, c=343): SubUnit[]
broadside(n, spacing): SubUnit[]
cardioidPair(spacing, c=343): SubUnit[]
cardioidTriple(spacing, c=343): SubUnit[]
arcArray(n, spacing, splayDeg): SubUnit[]
```

All five preset builders emit `SubUnit[]`, so a preset is just a starting arrangement — the user can drop into **Custom** at any time and edit any parameter by hand.

---

## 3. Presets

### End-fire (`endfire(n, spacing, c)`)

N units inline along the −x axis, spacing between adjacent units:

```
unit i:  x = −i·spacing,  y = 0,  delay = (n−1−i)·spacing/c,  polarity = +1
```

**Convention that matters.** The rearmost unit fires first (delay = 0). Each unit closer to the front gets an extra `spacing/c` of delay so the rear wavefront "catches up" and every unit sums coherently on the forward axis, **at every frequency**. A wrong-way delay (front-first) breaks on-axis coherence and was fixed early on.

Rear cancellation is frequency-dependent — it's perfect at `f = c/(4·spacing)` and meaningful (F/B > 10 dB for a two-element 1 m pair) in the band where `|cos(k·spacing)| < 0.316`, which is roughly **68 – 103 Hz** for 1 m spacing.

Tests pin:
- forward on-axis always coherent (0 dB) independent of f,
- rear is < −60 dB at `f = c/(4·spacing)`,
- F/B > 10 dB at 70, 80, 85, 100 Hz for 1 m spacing.

### Broadside (`broadside(n, spacing)`)

N units perpendicular to the forward axis, same polarity, no delay. Symmetric front↔back. Narrows horizontal coverage as `n·spacing/λ` grows, but does nothing to suppress the back. Test pins that `|p(0°)| = |p(180°)|` at every frequency.

### Cardioid pair (`cardioidPair(spacing, c)`)

Two units: one at the origin, one at `(−spacing, 0)` with inverted polarity and a delay of `spacing/c`:

```
front: x= 0,         y=0, delay= 0,           polarity=+1
rear : x=−spacing,   y=0, delay= spacing/c,   polarity=−1
```

**Rear null mathematics.** At 180° the rear unit is closer to the observer by `spacing`, arriving `spacing/c` earlier. Its applied delay `spacing/c` then cancels that head start — both signals arrive in lock-step. Their phasors are `+1` (front) and `−1` (rear, inverted polarity), so they sum to 0 at **every frequency**. That's the perfect rear null.

**Forward LF penalty.** On the forward axis the two signals arrive with path difference `spacing` and the rear is delayed by a further `spacing/c`, giving a total path-equivalent lag of `2·spacing` between polarity-inverted sources. Forward magnitude:

```
|p(0°, f)| = |1 − exp(−j · 2·k·spacing)| / 2 = |sin(k·spacing)|
```

This peaks at 0 dB at `f = c/(4·spacing)` (≈ 85.75 Hz for 1 m spacing) and rolls off below — the classic "cardioid LF penalty" that every cardioid topology shares. Test pins both `≈ 0 dB @ c/(4·spacing)` and `< −3 dB @ 30 Hz`.

### Cardioid triple (`cardioidTriple(spacing, c)`)

Two forward units + one inverted, delayed rear unit with `gain = 2` so the rear magnitude balances the summed front pair:

```
front L: x=0,        y=0,        delay=0,         polarity=+1, gain=1
front R: x=0,        y=spacing,  delay=0,         polarity=+1, gain=1
rear:    x=−spacing, y=spacing/2, delay=spacing/c, polarity=−1, gain=2
```

The `gain=2` is essential: with all three at unit gain the rear cancellation only reaches ≈ −9 dB (the two fronts sum to amplitude 2, a single rear can only subtract 1). With `gain=2`, `1+1−2 = 0` at the rear and the test pins rear < −40 dB across the useful band. Forward is the coherent sum of the two front units.

### Arc (`arcArray(n, spacing, splayDeg)`)

N broadside-style units with a small pull-back (1 − cos(splay)) · spacing on each outer unit, simulating a gentle arc. Widens horizontal coverage at the cost of off-axis lobing. All units share delay and polarity.

```
unit i: x = −|i − (n−1)/2| · spacing · (1 − cos(splay))
        y = (i − (n−1)/2) · spacing
```

Test pins that forward axis stays coherent (> −2 dB) at 60 Hz for typical parameters.

### Custom

Fully editable list: position x/y, delay (ms), linear gain, polarity, and per-unit removal. A polarity button flips between `+` (green) and `−` (red) to match the visualisation colour code.

---

## 4. Visualisations

Three linked views of the same reactive `subUnits` ref.

### (a) Polar plot (SVG)

`polarResponse(units, f, c, 361)` returns one sample per degree from 0° → 360° inclusive. The plot draws:

- concentric rings at −30 / −20 / −10 / 0 dB (the 0 dB ring is highlighted as the theoretical maximum),
- axis ticks at 0° / 90° / 180° / 270°,
- the response polygon filled with the accent colour.

Radial mapping clamps db to `[-30, 0]` so that `−30 dB → centre`, `0 dB → outer ring`. Test pins the 0° and 360° samples match exactly (they are the same physical direction).

### (b) 2D coverage heatmap (canvas)

Near-field complex-pressure sum over a user-set field size (3 – 40 m half-extent, default ±10 m), rendered on a square `<canvas>` at the analysis frequency.

Pipeline:

1. Pre-compute `k = 2π·f/c` and `ref = Σ|gainᵢ|`.
2. For each pixel: world coords `(worldX, worldY) = (forward, right)`, compute complex pressure by summing `(gain·pol / r) · exp(j·(−k·r − 2π·f·delay))` across all units (skipping r < 0.12 m to avoid the near-source singularity).
3. dB = `20·log₁₀(|p| / ref)`, clamped to `[−30, +6]`, mapped through a 5-stop colormap (deep blue → blue → green → yellow → red).
4. Overlay distance rings every 2 m, a forward arrow, and numbered unit markers coloured by polarity.

A separate vertical gradient bar shows the dB scale.

### (c) 3D array layout (Three.js)

One `THREE.BoxGeometry(D, H, W)` cabinet per unit at `(xᵢ, H/2, yᵢ)` (world X = forward, world Y = up, world Z = right). User-editable `boxW / boxH / boxD` controls let you match real cabinet dimensions (default 60 × 60 × 60 cm).

Overlays:

- **White edge wireframe** on each cabinet.
- **Dark front-face plate** on the +x side of each cabinet so you can see which way the driver points.
- **Polarity colour:** green (`+`) or red (`−`), with 85 % opacity.
- **Sprite label** above each cabinet: `#i ± d.d ms`.
- **Yellow dashed distance lines** between consecutive units with centre-to-centre metres callout.
- **Blue brackets** marking total footprint width (along y) and depth (along x).
- **Floor grid** (10 m × 10 m, 1 m divisions) and world axes (red = +x forward, green = +y up, blue = +z right) with a **FRONT** sprite on the +x axis.
- `OrbitControls` with damping: drag to orbit, scroll to zoom. Camera auto-fits the array on preset change.

The scene and resources are torn down on `onBeforeUnmount` (renderer, controls, ResizeObserver, animation frame) to prevent leaks when switching tabs.

---

## 5. Testable invariants

`src/core/__tests__/subArray.test.ts` (8 tests) pins the physics. The set was chosen so that a regression in any one preset math shows up as a test failure before the UI drifts:

| Invariant | Test phrase |
|---|---|
| Single unit is omnidirectional (0 dB at every θ) | "single sub is omnidirectional" |
| Two co-located coherent units sum to 0 dB normalised (raw magnitude = 2) | "coherent pair sums" |
| End-fire forward on-axis always coherent (0 dB at 30, 40, 80, 150 Hz) | "end-fire 2 × 1 m: coherent forward at every f" |
| End-fire rear null < −60 dB at `c/(4·spacing)` | (same test) |
| End-fire F/B > 10 dB at 70, 80, 85, 100 Hz for 1 m spacing | (same test) |
| Cardioid pair perfect rear null at all frequencies | "cardioid pair cancels the rear at every frequency" |
| Cardioid pair forward ≈ 0 dB at `c/(4·spacing)`, < −3 dB at 30 Hz (LF penalty) | (same test) |
| Cardioid triple rear null < −40 dB across band | "cardioid triple also cancels the rear" |
| Broadside `|p(0°)| == |p(180°)|` | "broadside array: forward and rear magnitudes are equal" |
| Polar 0° and 360° samples match | "polar response spans full 360°" |
| Arc stays coherent on axis at 60 Hz | "arc preset stays coherent on axis" |

Run `npm run test -- subArray` to execute just this suite.

---

## 6. Known limitations & roadmap

- **Omnidirectional unit model.** Each cabinet is modelled as a point source. Real subs have a cardioid-ish directivity above ~80 Hz; for design work below that frequency the point-source approximation is standard practice and what every MVV calculator assumes too.
- **Horizontal plane only.** The 2D heatmap and polar plot are both in the floor plane; vertical lobing is not visualised.
- **No ground plane.** The 2D coverage map does not include the floor bounce — add it from `mvv.ts::floorBounce` if you want to see the full comb response at ear height.
- **Heatmap resolution** is 520 × 520 px × N units, recomputed on every parameter change. Runs at > 60 fps for N ≤ 8; start-up cost is a few ms.
- **No SPL units.** Magnitudes are dB relative to the coherent-sum peak, not absolute SPL. Feed cabinet sensitivity + drive level into `coherentReference` externally if you need dB SPL.
- **No persistence.** The sub-array designer state (preset, unit positions, delays, gains) lives in local Vue `ref`s inside `CalculatorsView.vue`. It is **not** connected to any Pinia store or the `storage.ts` persistence layer, so custom configurations do not survive an app restart or a tab switch that unmounts the view.

Reasonable next features:
- Overlay the polar response from multiple frequencies (e.g. 40/60/80/100 Hz stacked).
- Save/load custom array layouts to the project JSON (currently, sub-array state is ephemeral `ref` state in `CalculatorsView.vue` — it is not wired into any Pinia store or the `storage.ts` persistence layer, so custom layouts are lost on app restart).
- Tie the designer to the Room view so an array can be dropped into an installation as a single aggregated source (requires bridging the currently isolated sub-array state into the `room` store).

## Credits

The end-fire / cardioid / broadside worked examples that back the test invariants come straight from **Merlijn van Veen**'s sub-array articles — https://www.merlijnvanveen.nl/en/calculators. This module is a TypeScript re-implementation of the underlying far-field physics plus a Three.js visualisation layer on top.

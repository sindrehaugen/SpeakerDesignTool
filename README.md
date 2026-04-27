# Speaker Design Tool v4

A browser-based simulation suite for designing Low-Z (4/8 Ω) and distributed (100 V / 70 V) loudspeaker installations. v4 is a full rewrite on a modern Vite + Vue 3 + TypeScript stack, with a spectral physics engine, a 3D room view, an SPL coverage heatmap, a set of acoustics calculators, and a subwoofer-array beamforming designer.

---

## What it does

For each branch of your signal chain the tool solves the transfer function across a log-spaced 20 Hz – 20 kHz grid:

- **Cable:** loop R(T) with copper α = 0.00393/°C, optional skin-effect √f term, loop L → jωL.
- **Speaker load:** flat nominal / `z_min` impedance across the band. Finished speaker products are modelled as flat loads; raw-driver resonances (Thiele-Small) are out of scope.
- **100 V transformer:** reflected impedance V²/P plus insertion-loss band-pass (default 60 Hz / 15 kHz, 0.8 dB IL).
- **Transmission:** voltage divider `I = Vsrc / |Zcable + Zload|`, `Vload = I · |Zload|`.
- **Room:** Sabine / Eyring RT60, direct + reverberant diffuse-field SPL, critical distance, simplified Steeneken STI.
- **Acoustics calculators:** speed of sound (Cramer 1993), wavelength/period, distance↔delay, phase↔delay, ISO 9613-1 air absorption, image-source floor bounce.
- **Subwoofer arrays:** far-field polar response, near-field 2D coverage heatmap, 3D cabinet layout with distance dimensions. End-fire / broadside / cardioid ×2 / cardioid ×3 / arc presets plus a fully editable custom mode.

Everything is pure functions — the UI reads a single reactive `analysis = computed(analyseChain(...))` derivation that replaces the old monolithic `calculateAll()`.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # Vitest — 46 unit tests across 7 files
npm run typecheck  # vue-tsc strict
npm run build      # production bundle in dist/
```

Node 18+ is required.

---

## Features

### Calculator tab

Hierarchical signal-chain builder with live per-node voltage drop, load Ω, HF loss and amplifier headroom grading against three quality targets (High-end 5 %, Average 10 %, Speech 15 %).

### Database tab

Edit / import / export Speakers, Cables, Amplifiers (CSV + JSON). Defaults load from `src/data/` on first run; edits persist to `localStorage`.

### Room & Coverage tab

Three.js 3D view of the installation:

- Place speakers as ceiling / wall / pendant / stand mounts with individual aim vectors.
- Mark obstacles, stages, raked-floor slopes and multiple listeners.
- Listener-plane SPL coverage heatmap (canvas-textured plane in 3D).
- Per-listener readout: SPL, STI, effective height when tied to a slope.
- RT60 (Sabine / Eyring), critical distance, diffuse-field SPL, Steeneken STI.

### Acoustics calculators tab

Standalone tools, independent of the rest of the design — every output is driven by a shared environment block (temperature °C, relative humidity %, atmospheric pressure Pa):

- **Speed of sound (Cramer 1993)** — full humid-air formula including CO₂ mole fraction.
- **Wavelength & period** from frequency.
- **Distance ↔ delay** conversions.
- **Phase ↔ delay** conversions (with sign-convention note).
- **Air absorption (ISO 9613-1)** — α(f) in dB/m and total loss over a user distance, tabulated across the eight octave bands 125 Hz – 16 kHz.
- **Floor-bounce comb filter** — image-source interference magnitude over 50 Hz – 20 kHz, plotted on a log-frequency axis.
- **Subwoofer array designer** — see below.

All calculators attribute their pedagogy to Merlijn van Veen (https://www.merlijnvanveen.nl/en/calculators). Detailed derivations and citations are in [`docs/ACOUSTICS.md`](docs/ACOUSTICS.md).

### Subwoofer array designer

Three linked visualisations of the same reactive array model:

1. **Polar response** (2D SVG, −30 dB centre → 0 dB outer ring) at a user-selected analysis frequency.
2. **Near-field 2D coverage heatmap** — canvas-rendered complex pressure sum over the horizontal plane, coloured −30 dB (deep blue) → +6 dB (red). Field size is adjustable 3 – 40 m.
3. **3D array layout** — Three.js scene with one cabinet per unit, user-editable box dimensions, centre-to-centre distance callouts (yellow dashed), and total footprint brackets (blue). Drag to orbit, scroll to zoom.

Presets: End-fire, Broadside, Cardioid ×2, Cardioid ×3, Arc, Custom. Readout shows forward / rear magnitude and front-to-back ratio at the analysis frequency. See [`docs/SUB_ARRAY.md`](docs/SUB_ARRAY.md) for the full beamforming derivation, preset math, and testable invariants.

### Reports tab

Landscape A4 PDF (via jsPDF + AutoTable) with cover page, BOM, per-node analysis rows, and optional screenshots. Zero-dependency `.xls` export (SpreadsheetML 2003) for Excel round-trip.

### Charts

Chart.js impedance-vs-frequency curve for the selected node, overlaid with the transfer-function magnitude.

### Persistence

Database, project preferences, and room layout are auto-saved through a
single storage abstraction (`src/services/storage.ts`). The same three keys
are used in both backends, so data round-trips cleanly between `npm run dev`
and the packaged desktop app:

| Key | Contents |
|---|---|
| `sdt_database_v4` | user-edited speakers / cables / amps |
| `sdt_user_prefs_v4` | project title, acceptance thresholds, environment |
| `sdt_room_v4` | geometry, speakers, obstacles, slopes, listeners |

- **Browser (`npm run dev`, `npm run preview`):** `localStorage`, same as before.
- **Desktop (`npm run tauri:dev`, packaged `.exe`):** JSON files in
  `%APPDATA%\com.speakerdesigntool.app\` (one file per key). Writes are
  debounced (250 ms) and flushed on window close. On first launch inside
  Tauri, any existing `localStorage` data is automatically migrated to disk.

---

## Desktop packaging (Tauri)

The Vue/Vite frontend is wrapped by a Rust + WebView2 shell under
`src-tauri/` to produce a standalone Windows `.exe` + installers.

### One-time prerequisite

Install the Rust toolchain (the `.exe` built from it has no Rust runtime
dependency — only the build host needs Rust):

```powershell
winget install Rustlang.Rustup
rustup default stable
```

Windows 10/11 already ships Edge WebView2, so no other runtimes are needed.

### Scripts

```bash
npm run tauri:dev     # hot-reload dev window (runs Vite + Rust shell together)
npm run tauri:build   # release build → src-tauri/target/release/
npm run tauri:icon    # regenerate icon set from src-tauri/app-icon.png
```

### What gets produced

`npm run tauri:build` emits:

- `src-tauri/target/release/Speaker Design Tool.exe` — standalone ~10 MB executable
- `src-tauri/target/release/bundle/msi/*.msi` — Windows Installer package
- `src-tauri/target/release/bundle/nsis/*-setup.exe` — NSIS installer

Ship any of the installers or the bare `.exe` — double-clicking it launches
the app without a dev server. The first run creates
`%APPDATA%\com.speakerdesigntool.app\` for persistent state.

### Icon

`src-tauri/app-icon.png` is a 1024×1024 placeholder. Drop in a real square
PNG and re-run `npm run tauri:icon` to regenerate every platform variant.

---

## Architecture

```
src/
  core/             Pure physics — no DOM, fully Vitest-covered
    complex.ts        Complex-number algebra (add/mul/div/polar/magnitude/phase)
    grid.ts           Log-spaced frequency grids + helpers
    cable.ts          R(T), skin-effect, loop inductance, series impedance
    driver.ts         Flat nominal / z_min speaker load
    transformer.ts    100 V reflected impedance + IL band-pass
    transmission.ts   Voltage-divider transfer function
    engine.ts         analyseChain — single reactive root for the whole UI
    room.ts           Sabine/Eyring RT60, direct+reverberant SPL, STI, geometry helpers
    mvv.ts            Acoustics calculators (Cramer c, ISO 9613-1 α, floor bounce, …)
    subArray.ts       Sub-array beamforming: phasor sum, presets, polar response
    __tests__/        Vitest suites — 46 tests across 7 files

  types/            domain.ts (Speaker, Cable, Amp, Project) + physics.ts

  stores/           Pinia
    database.ts       library CRUD + import/export
    project.ts        current project + reactive analysis tree
    room.ts           geometry, listeners, slopes, obstacles
    ui.ts             tab state, modals, wizard

  services/         io.ts (CSV/JSON/XLS) · report.ts (PDF) · wizard.ts (cable chooser)
                    storage.ts (Tauri-FS ↔ localStorage persistence layer)

  components/
    charts/           Chart.js wrappers
    modals/           AmpSelect, CableWizard, MissingData, SaveProject
    tree/             Recursive TreeNode (calculator tree)

  views/            Top-level tabs
    CalculatorView.vue    signal-chain tree + per-node analysis
    DatabaseView.vue      library editor
    RoomView.vue          Three.js 3D scene + heatmap
    CalculatorsView.vue   acoustics calculators + sub-array designer
    ReportsView.vue       PDF / XLS export
    ReferenceView.vue     in-app formula reference

  data/             Default equipment library + quality profiles
  styles/           Design-token CSS (no Tailwind)

src-tauri/          Rust + WebView2 desktop shell (tauri build → .exe)
  tauri.conf.json     app identity, window, bundle targets
  Cargo.toml          Rust manifest (tauri + tauri-plugin-fs)
  src/                Rust entry (main.rs, lib.rs) — thin, just wires plugins
  capabilities/       fs-plugin scope limited to %APPDATA%
  icons/              generated from app-icon.png via `tauri icon`
```

The v3 single-file HTML implementation has been moved to `legacy/` for reference.

---

## Testing

All physics lives in pure functions under `src/core/` and is covered by Vitest. 46 tests across 7 files; representative invariants:

| Suite | What it pins |
|---|---|
| `complex.test.ts` | magnitude/phase/add/mul/div/polar round-trip |
| `cable.test.ts` | R(T) linearity, skin-effect > 0 above threshold, loop L sanity |
| `driver.test.ts` | flat load behaviour; z_min fallback |
| `engine.test.ts` | analyseChain produces consistent voltage/current/SPL at each node |
| `room.test.ts` | Sabine vs Eyring convergence, direct+reverberant SPL, STI bounds |
| `mvv.test.ts` | Cramer c at reference conditions, α(f) monotonic vs f, floor bounce nulls at predicted frequencies |
| `subArray.test.ts` | End-fire always coherent forward + deep rear null at c/(4d); cardioid pair perfect rear cancellation + LF penalty; cardioid triple rear null; broadside symmetry; polar endpoints match at 0°/360°; arc stays coherent on axis |

Run the full suite with `npm test`, or `npm run test:watch` during development.

---

## Knowledge graph

The project ships a graph of its own codebase — run `/graphify` to rebuild:

- `graphify-out/graph.html` — interactive force-directed graph
- `graphify-out/GRAPH_REPORT.md` — god nodes, surprising cross-community edges, suggested exploratory queries
- `graphify-out/graph.json` — raw node/edge data (MCP-queryable)

---

## Physics reference

See the **Reference** tab in the app, or `src/views/ReferenceView.vue`, for the full set of formulas with citations. Deeper dives for the acoustics calculators and sub-array designer live in `docs/`.

- [`docs/ACOUSTICS.md`](docs/ACOUSTICS.md) — speed of sound, air absorption, floor bounce, delay/phase conversions, with full derivations and ISO references.
- [`docs/SUB_ARRAY.md`](docs/SUB_ARRAY.md) — beamforming model, preset math, the three visualisation layers (polar / 2D coverage / 3D layout), and how the unit tests pin each invariant.

## Credits

- The MVV acoustics calculators and subwoofer-array pedagogy are implementations of **Merlijn van Veen's** freely-published Excel calculators: https://www.merlijnvanveen.nl/en/calculators. This project re-implements the underlying formulae in TypeScript so they can feed the design tool and be unit-tested. Credit for the educational work belongs to him.

## License

See [LICENSE](LICENSE).

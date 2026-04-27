<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  speedOfSound, wavelength, period,
  delayFromDistance, distanceFromDelay,
  phaseFromDelay, delayFromPhase,
  airAbsorption, airAbsorptionDb,
  floorBounce, logFrequencyGrid,
} from '@/core/mvv'

// Environment controls shared by several calculators.
const T_C = ref(20)
const RH = ref(50)
const p_atm = ref(101325)
const c = computed(() => speedOfSound(T_C.value, RH.value, p_atm.value))

// Wavelength / period.
const freq = ref(1000)
const lambda = computed(() => wavelength(freq.value, c.value))
const periodMs = computed(() => period(freq.value) * 1000)

// Distance ↔ delay.
const distM = ref(10)
const delayMs = computed(() => delayFromDistance(distM.value, c.value) * 1000)
const delayInput = ref(10)
const distFromDelay = computed(() => distanceFromDelay(delayInput.value / 1000, c.value))

// Phase ↔ delay.
const phaseFreq = ref(1000)
const phaseDelayMs = ref(1)
const phaseDeg = computed(() => phaseFromDelay(phaseDelayMs.value / 1000, phaseFreq.value))
const phaseInputDeg = ref(180)
const delayFromPhaseMs = computed(() => delayFromPhase(phaseInputDeg.value, phaseFreq.value) * 1000)

// Air absorption.
const absorbDist = ref(30)
const absorbBands = [125, 250, 500, 1000, 2000, 4000, 8000, 16000]
const absorbRows = computed(() =>
  absorbBands.map((f) => ({
    f,
    alpha: airAbsorption(f, T_C.value, RH.value, p_atm.value),
    dB: airAbsorptionDb(f, absorbDist.value, T_C.value, RH.value, p_atm.value),
  })),
)

// Floor bounce.
const fbDist = ref(4)
const fbSrcH = ref(1.2)
const fbMicH = ref(1.2)
const fbReflect = ref(0.8)
const fbGrid = logFrequencyGrid(50, 20000, 120)
const fbSamples = computed(() =>
  fbGrid.map((f) => ({
    f,
    db: floorBounce(f, fbDist.value, fbSrcH.value, fbMicH.value, fbReflect.value, c.value),
  })),
)
const fbViewBox = '0 -24 600 48'
const fbPath = computed(() => {
  const fMin = Math.log10(fbGrid[0]!)
  const fMax = Math.log10(fbGrid[fbGrid.length - 1]!)
  const xOf = (f: number) => ((Math.log10(f) - fMin) / (fMax - fMin)) * 600
  const yOf = (db: number) => -db // 1 px per dB, centre at 0
  return fbSamples.value
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${xOf(s.f).toFixed(1)},${yOf(s.db).toFixed(1)}`)
    .join(' ')
})

function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '–'
  return n.toFixed(digits)
}

</script>

<template>
  <div class="calcs">
    <div class="card credit">
      <h2>Acoustics calculators</h2>
      <p>
        These calculators are based on the work of
        <a href="https://www.merlijnvanveen.nl/en/calculators" target="_blank" rel="noopener">Merlijn van Veen</a>.
        The original Excel spreadsheets are freely available on his website; this
        panel re-implements the same formulae (Cramer 1993 speed of sound,
        ISO 9613-1 air absorption, image-source comb filtering, etc.) in
        TypeScript so they can feed the design tool and be unit-tested. Credit
        for pulling these formulae together into accessible calculators belongs
        to Merlijn van Veen.
      </p>
    </div>

    <div class="card">
      <h3>Environment</h3>
      <div class="grid3">
        <label>Temperature (°C)
          <input type="number" step="0.5" v-model.number="T_C" />
        </label>
        <label>Relative humidity (%)
          <input type="number" step="1" min="0" max="100" v-model.number="RH" />
        </label>
        <label>Atmospheric pressure (Pa)
          <input type="number" step="100" v-model.number="p_atm" />
        </label>
      </div>
      <p class="readout">
        Speed of sound <strong>c = {{ fmt(c, 2) }} m/s</strong>
      </p>
    </div>

    <div class="card">
      <h3>Wavelength &amp; period</h3>
      <div class="grid2">
        <label>Frequency (Hz)
          <input type="number" step="1" v-model.number="freq" />
        </label>
        <div class="readout">
          λ = <strong>{{ fmt(lambda * 100, 2) }} cm</strong>
          &nbsp;·&nbsp;
          T = <strong>{{ fmt(periodMs, 3) }} ms</strong>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Distance ↔ delay</h3>
      <div class="grid2">
        <label>Distance (m)
          <input type="number" step="0.1" v-model.number="distM" />
        </label>
        <div class="readout">delay = <strong>{{ fmt(delayMs, 2) }} ms</strong></div>
      </div>
      <div class="grid2">
        <label>Delay (ms)
          <input type="number" step="0.1" v-model.number="delayInput" />
        </label>
        <div class="readout">distance = <strong>{{ fmt(distFromDelay, 3) }} m</strong></div>
      </div>
    </div>

    <div class="card">
      <h3>Phase ↔ delay</h3>
      <div class="grid3">
        <label>Frequency (Hz)
          <input type="number" step="1" v-model.number="phaseFreq" />
        </label>
        <label>Delay (ms)
          <input type="number" step="0.1" v-model.number="phaseDelayMs" />
        </label>
        <div class="readout">phase = <strong>{{ fmt(phaseDeg, 1) }}°</strong></div>
      </div>
      <div class="grid3">
        <label>Frequency (Hz)
          <input type="number" step="1" v-model.number="phaseFreq" />
        </label>
        <label>Phase (°)
          <input type="number" step="5" v-model.number="phaseInputDeg" />
        </label>
        <div class="readout">delay = <strong>{{ fmt(delayFromPhaseMs, 3) }} ms</strong></div>
      </div>
      <p class="muted">Sign convention: a positive delay produces a negative (lagging) phase shift.</p>
    </div>

    <div class="card">
      <h3>Air absorption (ISO 9613-1)</h3>
      <div class="grid2">
        <label>Propagation distance (m)
          <input type="number" step="1" v-model.number="absorbDist" />
        </label>
        <div class="readout muted">At {{ T_C }} °C, {{ RH }} % RH, {{ (p_atm/1000).toFixed(1) }} kPa.</div>
      </div>
      <table class="absorb">
        <thead>
          <tr><th>f (Hz)</th><th>α (dB/m)</th><th>Loss at {{ absorbDist }} m (dB)</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in absorbRows" :key="r.f">
            <td>{{ r.f }}</td>
            <td>{{ fmt(r.alpha, 4) }}</td>
            <td>{{ fmt(r.dB, 2) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h3>Floor bounce (comb filter)</h3>
      <div class="grid4">
        <label>Horizontal distance (m)
          <input type="number" step="0.1" v-model.number="fbDist" />
        </label>
        <label>Source height (m)
          <input type="number" step="0.1" v-model.number="fbSrcH" />
        </label>
        <label>Mic height (m)
          <input type="number" step="0.1" v-model.number="fbMicH" />
        </label>
        <label>Reflection coeff.
          <input type="number" step="0.05" min="0" max="1" v-model.number="fbReflect" />
        </label>
      </div>
      <svg class="fb-plot" :viewBox="fbViewBox" preserveAspectRatio="none">
        <line x1="0" y1="0" x2="600" y2="0" stroke="var(--border)" stroke-width="0.4" />
        <line x1="0" y1="-6" x2="600" y2="-6" stroke="var(--border)" stroke-dasharray="2,3" stroke-width="0.3" />
        <line x1="0" y1="6" x2="600" y2="6" stroke="var(--border)" stroke-dasharray="2,3" stroke-width="0.3" />
        <path :d="fbPath" fill="none" stroke="var(--accent)" stroke-width="1.2" />
      </svg>
      <p class="muted">Y axis: ±24 dB deviation from direct-only SPL. X axis: 50 Hz – 20 kHz (log).</p>
    </div>
  </div>
</template>

<style scoped>
.calcs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 8px;
}

.card {
  padding: 10px 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-1);
}

.credit {
  border-left: 2px solid var(--accent);
  background:
    linear-gradient(90deg, var(--accent-soft) 0%, transparent 30%),
    var(--bg-1);
}
.credit :deep(h2) {
  color: var(--accent);
  font-size: 12px;
}
.credit p {
  font-size: 11px;
  line-height: 1.55;
  color: var(--fg-dim);
  margin: 6px 0 0 0;
}
.credit a { color: var(--accent); text-decoration: none; border-bottom: 1px dotted var(--accent-line); }
.credit a:hover { border-bottom-style: solid; }

h3 {
  margin: 0 0 8px 0;
  color: var(--fg);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-soft);
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-items: end;
  margin-bottom: 6px;
}
.grid3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  align-items: end;
  margin-bottom: 6px;
}
.grid4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  align-items: end;
  margin-bottom: 8px;
}

label {
  display: flex;
  flex-direction: column;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
  gap: 3px;
}
input {
  padding: 3px 6px;
  height: 24px;
  font-size: 12px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* Numeric readout — meter strip */
.readout {
  padding: 6px 10px;
  height: 26px;
  display: flex;
  align-items: center;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-left: 2px solid var(--accent);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--fg-dim);
}
.readout strong {
  color: var(--accent);
  font-weight: 600;
  margin: 0 2px;
}
.muted {
  color: var(--fg-subtle);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 4px 0 0 0;
}

/* Air-absorption table */
table.absorb {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin-top: 6px;
  font-size: 11px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
table.absorb th, table.absorb td {
  text-align: right;
  padding: 3px 10px;
  height: 22px;
  border-bottom: 1px solid var(--border-soft);
}
table.absorb tr:last-child td { border-bottom: 0; }
table.absorb th {
  font-family: var(--font-sans);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
}
table.absorb th:first-child,
table.absorb td:first-child { text-align: left; color: var(--fg); }
table.absorb tbody tr:hover { background: var(--bg-2); }

/* Floor-bounce comb plot — oscilloscope frame */
.fb-plot {
  width: 100%;
  height: 160px;
  background:
    linear-gradient(transparent 49.5%, rgba(34,211,238,0.10) 50%, transparent 50.5%),
    repeating-linear-gradient(90deg, transparent 0 59px, rgba(255,255,255,0.03) 59px 60px),
    repeating-linear-gradient(0deg,  transparent 0 23px, rgba(255,255,255,0.03) 23px 24px),
    radial-gradient(ellipse at center, #0b1220 0%, #050810 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 24px rgba(0,0,0,0.6);
  margin-top: 4px;
}
</style>
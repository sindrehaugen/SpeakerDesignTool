<script setup lang="ts">
</script>

<template>
  <div class="reference">
    <div class="card">
      <h2>Physics reference</h2>
      <p>
        The calculator models each branch as a voltage source feeding a voice-coil load
        through a cable, solved across a log-spaced 48-point grid spanning 20 Hz – 20 kHz.
      </p>

      <h3>Cable impedance</h3>
      <p class="mono">Z_cable(f, T) = R_loop(T) · (1 + k·√(f/1000)) + jωL_loop</p>
      <p class="muted">
        R_loop scales with copper temperature coefficient α = 0.00393/°C.
        Skin effect adds a √f term that becomes significant for long, thick runs above 4 kHz.
      </p>

      <h3>Speaker load</h3>
      <p class="mono">Z_speaker(f) = z_min   (flat across the audio band)</p>
      <p class="muted">
        Finished speaker products are modelled as flat-impedance loads at their measured
        minimum impedance (or nominal impedance when z_min is not published).
        Raw driver resonances (Thiele-Small) are out of scope for this tool — they
        only matter at the cabinet-design stage, which happens upstream of the
        installation work this tool targets.
      </p>

      <h3>100V / 70V transformer</h3>
      <p class="mono">Z_reflected = V_line² / P_tap</p>
      <p class="muted">
        Insertion loss ~0.8 dB. Bandpass shape: 60 Hz HP, 15 kHz LP by default.
      </p>

      <h3>Voltage divider</h3>
      <p class="mono">I(f) = V_src / |Z_cable(f) + Z_load(f)|</p>
      <p class="mono">V_load(f) = I · |Z_load(f)|</p>

      <h3>Room acoustics</h3>
      <p class="mono">RT60 = 0.161 · V / A   (Sabine)</p>
      <p class="mono">RT60 = 0.161 · V / (−S·ln(1−α))   (Eyring, used for α &gt; 0.3)</p>
      <p class="mono">L_p(r) = L_w − 20·log₁₀(r) − 11    ‖   L_rev = L_w + 10·log₁₀(4/R)</p>
      <p class="muted">R = S·α/(1−α) is the room constant. Critical distance = 0.141·√(Q·V/RT60).</p>

      <h3>STI estimation</h3>
      <p class="muted">
        A simplified Steeneken–Houtgast MTF is computed from SNR and RT60 and mapped to
        the 0–1 STI index. 0.75+ = excellent, 0.60–0.75 = good, 0.45–0.60 = fair.
      </p>

      <h3>Quality targets</h3>
      <ul>
        <li><strong>High-end:</strong> max 5% drop, HF check @ 10 kHz</li>
        <li><strong>Average:</strong> max 10% drop, HF check @ 6 kHz</li>
        <li><strong>Speech:</strong> max 15% drop, HF check @ 4 kHz</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.reference {
  max-width: 880px;
  margin: 0 auto;
  padding: 8px;
}

.reference .card {
  padding: 16px 20px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-1);
}

.reference :deep(h2) {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  color: var(--fg);
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border);
  position: relative;
}
.reference :deep(h2)::before {
  content: "§";
  color: var(--accent);
  font-family: var(--font-mono);
  font-weight: 700;
  margin-right: 8px;
}

.reference h3 {
  margin-top: 20px;
  margin-bottom: 4px;
  color: var(--accent);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  padding-left: 10px;
  border-left: 2px solid var(--accent);
}

.reference p {
  margin: 6px 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--fg-dim);
}

/* Equation lines — typeset like LaTeX */
.reference p.mono {
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--fg);
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-left: 2px solid var(--accent-line);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  padding: 6px 10px;
  margin: 4px 0;
  letter-spacing: 0;
}

.reference .muted {
  color: var(--fg-subtle);
  font-size: 11px;
  font-style: normal;
  padding-left: 12px;
  border-left: 1px dotted var(--border);
  margin: 4px 0 8px 4px;
}

.reference ul {
  padding-left: 0;
  margin: 8px 0;
  list-style: none;
}
.reference ul li {
  padding: 4px 10px;
  margin-bottom: 2px;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--fg-dim);
  line-height: 1.5;
}
.reference ul li strong {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-right: 6px;
}
</style>

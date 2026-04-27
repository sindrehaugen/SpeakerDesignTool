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
.reference { max-width: 800px; margin: 0 auto; }
.reference h3 { margin-top: 18px; margin-bottom: 6px; color: var(--accent); }
.reference p { margin: 6px 0; }
.reference ul { padding-left: 22px; line-height: 1.8; }
</style>

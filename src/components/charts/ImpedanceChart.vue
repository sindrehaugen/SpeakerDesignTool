<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale, LogarithmicScale,
  CategoryScale, Tooltip, Legend,
} from 'chart.js'
import type { BranchAnalysis } from '@/types/physics'

ChartJS.register(LineElement, PointElement, LinearScale, LogarithmicScale, CategoryScale, Tooltip, Legend)

const props = defineProps<{ branch: BranchAnalysis | null }>()

const data = computed(() => {
  const b = props.branch
  if (!b) return { labels: [], datasets: [] }
  return {
    labels: b.frequencies.map((f) => Math.round(f)),
    datasets: [
      {
        label: 'LOAD Z (Ω)',
        data: b.loadImpedance.map((z) => z.magnitude()),
        borderColor: '#22d3ee',
        backgroundColor: 'rgba(34, 211, 238, 0.10)',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointHoverBackgroundColor: '#22d3ee',
        tension: 0.25,
        fill: false,
      },
      {
        label: 'CABLE Z (Ω)',
        data: b.cableImpedance.map((z) => z.magnitude()),
        borderColor: '#f5a524',
        backgroundColor: 'rgba(245, 165, 36, 0.10)',
        borderWidth: 1.5,
        borderDash: [4, 3],
        pointRadius: 0,
        pointHoverRadius: 3,
        pointHoverBackgroundColor: '#f5a524',
        tension: 0.25,
        fill: false,
      },
    ],
  }
})

const GRID = 'rgba(255, 255, 255, 0.05)'
const TICK = '#5a6472'
const TITLE = '#8b95a3'
const FG = '#e6ebf2'
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

const options = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  scales: {
    x: {
      type: 'logarithmic' as const,
      title: { display: true, text: 'FREQUENCY · Hz', color: TITLE, font: { family: MONO, size: 9, weight: 600 } },
      ticks: { color: TICK, font: { family: MONO, size: 10 } },
      grid: { color: GRID, drawTicks: false },
      border: { color: GRID },
    },
    y: {
      type: 'logarithmic' as const,
      title: { display: true, text: 'IMPEDANCE · Ω', color: TITLE, font: { family: MONO, size: 9, weight: 600 } },
      ticks: { color: TICK, font: { family: MONO, size: 10 } },
      grid: { color: GRID, drawTicks: false },
      border: { color: GRID },
    },
  },
  plugins: {
    legend: {
      labels: {
        color: FG,
        font: { family: MONO, size: 10, weight: 600 },
        boxWidth: 18,
        boxHeight: 2,
        padding: 12,
      },
    },
    tooltip: {
      backgroundColor: '#0b0d10',
      borderColor: '#22d3ee',
      borderWidth: 1,
      titleColor: '#22d3ee',
      bodyColor: FG,
      titleFont: { family: MONO, size: 10, weight: 600 },
      bodyFont: { family: MONO, size: 10 },
      padding: 8,
      cornerRadius: 2,
      displayColors: false,
    },
  },
}
</script>

<template>
  <div class="chart">
    <Line v-if="branch" :data="data" :options="options" />
    <p v-else class="empty">— NO NODE SELECTED —<br /><span>Pick a chain node to view impedance curves.</span></p>
  </div>
</template>

<style scoped>
.chart {
  height: 240px;
  padding: 6px;
  background:
    repeating-linear-gradient(90deg, transparent 0 39px, rgba(255,255,255,0.018) 39px 40px),
    repeating-linear-gradient(0deg,  transparent 0 23px, rgba(255,255,255,0.018) 23px 24px),
    radial-gradient(ellipse at center, #0b1220 0%, #050810 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 24px rgba(0,0,0,0.6);
  position: relative;
}
.chart::before {
  content: "Z(f) · log/log";
  position: absolute;
  top: 6px;
  right: 10px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.10em;
  color: var(--accent);
  opacity: 0.7;
  pointer-events: none;
  z-index: 1;
}
.empty {
  text-align: center;
  color: var(--fg-subtle);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.10em;
  margin: 0;
  padding-top: 80px;
}
.empty span {
  display: block;
  margin-top: 8px;
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: none;
  color: var(--fg-subtle);
  opacity: 0.7;
}
</style>

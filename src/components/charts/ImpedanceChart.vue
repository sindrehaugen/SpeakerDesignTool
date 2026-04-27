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
        label: 'Load Z (Ω)',
        data: b.loadImpedance.map((z) => z.magnitude()),
        borderColor: '#3b82f6',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: 'Cable Z (Ω)',
        data: b.cableImpedance.map((z) => z.magnitude()),
        borderColor: '#f59e0b',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
      },
    ],
  }
})

const options = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { type: 'logarithmic' as const, title: { display: true, text: 'Hz' }, ticks: { color: '#a1a1aa' } },
    y: { type: 'logarithmic' as const, title: { display: true, text: 'Ω' }, ticks: { color: '#a1a1aa' } },
  },
  plugins: { legend: { labels: { color: '#fafafa' } } },
}
</script>

<template>
  <div class="chart">
    <Line v-if="branch" :data="data" :options="options" />
    <p v-else class="muted">Select a node to view impedance curves.</p>
  </div>
</template>

<style scoped>
.chart { height: 220px; }
</style>

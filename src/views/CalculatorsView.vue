<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  speedOfSound, wavelength, period,
  delayFromDistance, distanceFromDelay,
  phaseFromDelay, delayFromPhase,
  airAbsorption, airAbsorptionDb,
  floorBounce, logFrequencyGrid,
} from '@/core/mvv'
import {
  type SubUnit,
  polarResponse, directivityDb, frontToBackDb, coherentReference,
  endfire, broadside, cardioidPair, cardioidTriple, arcArray,
} from '@/core/subArray'

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

// ─── Sub-array beamforming ───────────────────────────────────────────────────
type SubPreset = 'endfire' | 'broadside' | 'cardioid2' | 'cardioid3' | 'arc' | 'custom'
const subPreset = ref<SubPreset>('endfire')
const subCount = ref(2)
const subSpacing = ref(1.0)
const subSplayDeg = ref(15)
const subFreq = ref(80)
const subUnits = ref<SubUnit[]>(endfire(2, 1, c.value))

function rebuildSubPreset(): void {
  const cNow = c.value
  switch (subPreset.value) {
    case 'endfire':    subUnits.value = endfire(subCount.value, subSpacing.value, cNow); break
    case 'broadside':  subUnits.value = broadside(subCount.value, subSpacing.value); break
    case 'cardioid2':  subUnits.value = cardioidPair(subSpacing.value, cNow); break
    case 'cardioid3':  subUnits.value = cardioidTriple(subSpacing.value, cNow); break
    case 'arc':        subUnits.value = arcArray(subCount.value, subSpacing.value, subSplayDeg.value); break
    case 'custom':     /* leave as-is */ break
  }
}
function selectPreset(p: SubPreset): void { subPreset.value = p; rebuildSubPreset() }
function onCountChange(): void { if (subPreset.value !== 'custom') rebuildSubPreset() }
function onSpacingChange(): void { if (subPreset.value !== 'custom') rebuildSubPreset() }
function onSplayChange(): void { if (subPreset.value === 'arc') rebuildSubPreset() }
function addCustomUnit(): void {
  subPreset.value = 'custom'
  subUnits.value = [
    ...subUnits.value,
    { x: 0, y: 0, delay: 0, polarity: 1, gain: 1, label: `Sub ${subUnits.value.length + 1}` },
  ]
}
function removeCustomUnit(i: number): void {
  subPreset.value = 'custom'
  subUnits.value = subUnits.value.filter((_, k) => k !== i)
}
function updateCustomUnit(i: number, patch: Partial<SubUnit>): void {
  subPreset.value = 'custom'
  subUnits.value = subUnits.value.map((u, k) => (k === i ? { ...u, ...patch } : u))
}

const subPolar = computed(() => polarResponse(subUnits.value, subFreq.value, c.value, 361))
const subFwd = computed(() => directivityDb(subUnits.value, subFreq.value, 0, c.value))
const subRear = computed(() => directivityDb(subUnits.value, subFreq.value, 180, c.value))
const subFb = computed(() => frontToBackDb(subUnits.value, subFreq.value, c.value))

const POLAR_R = 110  // radius, dB floor at -30 (so −30 dB → centre)
const POLAR_FLOOR = -30
const polarPath = computed(() => {
  const pts = subPolar.value
  if (!pts.length) return ''
  const mapR = (db: number) => {
    const clamped = Math.max(POLAR_FLOOR, Math.min(0, db))
    return POLAR_R * (1 - clamped / POLAR_FLOOR)
  }
  return pts
    .map((p, i) => {
      const a = (p.thetaDeg * Math.PI) / 180
      const r = mapR(p.db)
      const x = r * Math.cos(a)
      const y = -r * Math.sin(a) // SVG: y grows downward; flip so +y is up
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ') + ' Z'
})
const polarRings = [-30, -20, -10, 0].map((db) => ({
  db,
  r: POLAR_R * (1 - db / POLAR_FLOOR),
}))

// Sub-plan mini diagram
const subPlanBounds = computed(() => {
  const xs = subUnits.value.map((u) => u.x)
  const ys = subUnits.value.map((u) => u.y)
  const pad = 0.5
  return {
    minX: Math.min(-pad, ...xs) - pad,
    maxX: Math.max(pad, ...xs) + pad,
    minY: Math.min(-pad, ...ys) - pad,
    maxY: Math.max(pad, ...ys) + pad,
  }
})
const subPlanViewBox = computed(() => {
  const b = subPlanBounds.value
  return `${b.minX} ${b.minY} ${b.maxX - b.minX} ${b.maxY - b.minY}`
})

// ─── 2D coverage heatmap (near-field pressure sum) ──────────────────────────
const coverageCanvas = ref<HTMLCanvasElement | null>(null)
const covExtent = ref(10) // ± metres around array centre

// 5-stop colormap: deep blue → blue → green → yellow → red.
function covColor(t: number): [number, number, number] {
  const tt = Math.max(0, Math.min(1, t))
  const stops: Array<[number, [number, number, number]]> = [
    [0.00, [24, 36, 62]],
    [0.25, [37, 99, 235]],
    [0.50, [34, 197, 94]],
    [0.75, [234, 179, 8]],
    [1.00, [239, 68, 68]],
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i]!
    const [t1, c1] = stops[i + 1]!
    if (tt >= t0 && tt <= t1) {
      const u = (tt - t0) / (t1 - t0)
      return [
        Math.round(c0[0] + u * (c1[0] - c0[0])),
        Math.round(c0[1] + u * (c1[1] - c0[1])),
        Math.round(c0[2] + u * (c1[2] - c0[2])),
      ]
    }
  }
  return stops[stops.length - 1]![1]
}

function drawCoverage(): void {
  const canvas = coverageCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  const extent = covExtent.value
  const units = subUnits.value
  const f = subFreq.value
  const cNow = c.value
  const k = (2 * Math.PI * f) / cNow
  const ref = coherentReference(units) // amps at r = 1 m
  const DB_MIN = -30
  const DB_MAX = 6
  const SPAN = DB_MAX - DB_MIN

  const img = ctx.createImageData(w, h)
  const data = img.data
  for (let py = 0; py < h; py++) {
    // Canvas Y axis points down; map top of canvas to +forward (+x world).
    const worldX = extent - (py / (h - 1)) * 2 * extent
    for (let px = 0; px < w; px++) {
      // Canvas X left→right is world +y (right).
      const worldY = (px / (w - 1)) * 2 * extent - extent
      let re = 0
      let im = 0
      for (const u of units) {
        const dx = worldX - u.x
        const dy = worldY - u.y
        const r = Math.hypot(dx, dy)
        if (r < 0.12) { re += 0; im += 0; continue }
        const g = ((u.gain ?? 1) * u.polarity) / r
        const phi = -k * r - 2 * Math.PI * f * u.delay
        re += g * Math.cos(phi)
        im += g * Math.sin(phi)
      }
      const mag = Math.hypot(re, im)
      const db = mag > 0 ? 20 * Math.log10(mag / ref) : DB_MIN
      const t = (Math.max(DB_MIN, Math.min(DB_MAX, db)) - DB_MIN) / SPAN
      const [rr, gg, bb] = covColor(t)
      const idx = (py * w + px) * 4
      data[idx] = rr
      data[idx + 1] = gg
      data[idx + 2] = bb
      data[idx + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  // Overlay: distance rings, forward arrow, array units.
  const worldToPxX = (wy: number) => ((wy + extent) / (2 * extent)) * (w - 1)
  const worldToPxY = (wx: number) => ((extent - wx) / (2 * extent)) * (h - 1)
  const originX = worldToPxX(0)
  const originY = worldToPxY(0)

  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  ctx.lineWidth = 1
  for (let r = 2; r <= extent; r += 2) {
    const pxR = (r / extent) * (w / 2)
    ctx.beginPath()
    ctx.arc(originX, originY, pxR, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '10px sans-serif'
  for (let r = 2; r <= extent; r += 2) {
    const pxR = (r / extent) * (w / 2)
    ctx.fillText(`${r} m`, originX + 3, originY - pxR - 2)
  }

  // Forward arrow (world +x → up).
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(originX, originY)
  ctx.lineTo(originX, 22)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(originX - 6, 32)
  ctx.lineTo(originX, 20)
  ctx.lineTo(originX + 6, 32)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText('FRONT', originX + 9, 26)

  // Array units.
  for (let i = 0; i < units.length; i++) {
    const u = units[i]!
    const cx = worldToPxX(u.y)
    const cy = worldToPxY(u.x)
    ctx.fillStyle = u.polarity === 1 ? '#4ade80' : '#f43f5e'
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'white'
    ctx.font = 'bold 10px sans-serif'
    ctx.fillText(String(i + 1), cx - 3, cy + 3)
  }
}

onMounted(() => drawCoverage())
watch([subUnits, subFreq, c, covExtent], () => drawCoverage(), { deep: true })

// ─── 3D array view (Three.js) ────────────────────────────────────────────────
// Physical dimensions of one cabinet in metres (typical 1× 18" sub = 60 × 60 × 60 cm).
const boxW = ref(0.60) // width  (along y-axis / left-right)
const boxH = ref(0.60) // height (along z-axis / up-down)
const boxD = ref(0.60) // depth  (along x-axis / front-back)

const threeMount = ref<HTMLDivElement | null>(null)
let renderer: THREE.WebGLRenderer | null = null
let scene3: THREE.Scene | null = null
let camera3: THREE.PerspectiveCamera | null = null
let controls3: OrbitControls | null = null
let arrayGroup: THREE.Group | null = null
let rafId = 0
let ro: ResizeObserver | null = null

function makeLabelSprite(text: string, color = '#e5e7eb'): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const dpr = window.devicePixelRatio || 1
  const fontPx = 48
  ctx.font = `bold ${fontPx}px sans-serif`
  const pad = 14
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2
  const h = fontPx + pad * 2
  canvas.width = w * dpr
  canvas.height = h * dpr
  const c2 = canvas.getContext('2d')!
  c2.scale(dpr, dpr)
  c2.font = `bold ${fontPx}px sans-serif`
  c2.fillStyle = 'rgba(15, 23, 42, 0.88)'
  c2.fillRect(0, 0, w, h)
  c2.strokeStyle = 'rgba(255,255,255,0.2)'
  c2.strokeRect(0.5, 0.5, w - 1, h - 1)
  c2.fillStyle = color
  c2.textBaseline = 'middle'
  c2.fillText(text, pad, h / 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  const spr = new THREE.Sprite(mat)
  const scale = 0.004 // 1 px → 0.004 world units
  spr.scale.set(w * scale, h * scale, 1)
  spr.renderOrder = 999
  return spr
}

function rebuildArray3d(): void {
  if (!scene3 || !arrayGroup) return
  while (arrayGroup.children.length) {
    const c0 = arrayGroup.children[0]!
    arrayGroup.remove(c0)
    if ((c0 as THREE.Mesh).geometry) (c0 as THREE.Mesh).geometry.dispose()
    const m = (c0 as THREE.Mesh).material
    if (Array.isArray(m)) m.forEach((mm) => mm.dispose())
    else if (m) (m as THREE.Material).dispose()
  }

  const units = subUnits.value
  if (!units.length) return
  const W = boxW.value, H = boxH.value, D = boxD.value
  const geom = new THREE.BoxGeometry(D, H, W) // x=depth, y=height, z=width
  const edgeGeom = new THREE.EdgesGeometry(geom)

  for (let i = 0; i < units.length; i++) {
    const u = units[i]!
    const matColor = u.polarity === 1 ? 0x22c55e : 0xf43f5e
    const mat = new THREE.MeshStandardMaterial({
      color: matColor, roughness: 0.6, metalness: 0.1, transparent: true, opacity: 0.85,
    })
    const box = new THREE.Mesh(geom, mat)
    // Local coords: u.x = forward (+x world), u.y = right (+z world), cabinet sits on floor.
    box.position.set(u.x, H / 2, u.y)
    arrayGroup.add(box)

    const edges = new THREE.LineSegments(
      edgeGeom,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }),
    )
    edges.position.copy(box.position)
    arrayGroup.add(edges)

    // Forward-face marker (thin plate on the +x side of the cabinet).
    const faceGeom = new THREE.PlaneGeometry(W * 0.75, H * 0.55)
    const faceMat = new THREE.MeshBasicMaterial({ color: 0x0b1220, side: THREE.DoubleSide })
    const face = new THREE.Mesh(faceGeom, faceMat)
    face.rotation.y = Math.PI / 2
    face.position.set(u.x + D / 2 + 0.001, H / 2, u.y)
    arrayGroup.add(face)

    // Unit label above cabinet.
    const label = makeLabelSprite(
      `#${i + 1} ${u.polarity === 1 ? '+' : '−'}  ${(u.delay * 1000).toFixed(1)} ms`,
      '#f1f5f9',
    )
    label.position.set(u.x, H + 0.22, u.y)
    arrayGroup.add(label)
  }

  // Distance measurements between consecutive units.
  for (let i = 0; i < units.length - 1; i++) {
    const a = units[i]!, b = units[i + 1]!
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    if (dist < 1e-3) continue
    // Draw dimension line slightly above the floor.
    const y0 = 0.02
    const ax = a.x, az = a.y, bx = b.x, bz = b.y
    const mat = new THREE.LineDashedMaterial({
      color: 0xfacc15, dashSize: 0.08, gapSize: 0.06, linewidth: 1,
    })
    const pts = [new THREE.Vector3(ax, y0, az), new THREE.Vector3(bx, y0, bz)]
    const lineGeom = new THREE.BufferGeometry().setFromPoints(pts)
    const line = new THREE.Line(lineGeom, mat)
    line.computeLineDistances()
    arrayGroup.add(line)

    // Distance label at midpoint.
    const mid = new THREE.Vector3((ax + bx) / 2, 0.35, (az + bz) / 2)
    const label = makeLabelSprite(`${dist.toFixed(2)} m`, '#fde68a')
    label.position.copy(mid)
    arrayGroup.add(label)
  }

  // Overall footprint dimensions (bounding box of unit centres, padded by cabinet size).
  const xs = units.map((u) => u.x), ys = units.map((u) => u.y)
  const minX = Math.min(...xs) - D / 2, maxX = Math.max(...xs) + D / 2
  const minY = Math.min(...ys) - W / 2, maxY = Math.max(...ys) + W / 2
  const widthTotal = maxY - minY
  const depthTotal = maxX - minX
  if (units.length > 1) {
    // Width bracket along −depth edge (front).
    const bracketY = minX - 0.4
    const bracketMat = new THREE.LineBasicMaterial({ color: 0x60a5fa })
    const bracketPts = [
      new THREE.Vector3(bracketY, 0, minY),
      new THREE.Vector3(bracketY, 0, maxY),
    ]
    const bg = new THREE.BufferGeometry().setFromPoints(bracketPts)
    arrayGroup.add(new THREE.Line(bg, bracketMat))
    const wLabel = makeLabelSprite(`width ${widthTotal.toFixed(2)} m`, '#bfdbfe')
    wLabel.position.set(bracketY, 0.25, (minY + maxY) / 2)
    arrayGroup.add(wLabel)

    // Depth bracket along +width edge (right).
    const bracketX = maxY + 0.4
    const depthPts = [
      new THREE.Vector3(minX, 0, bracketX),
      new THREE.Vector3(maxX, 0, bracketX),
    ]
    const dg = new THREE.BufferGeometry().setFromPoints(depthPts)
    arrayGroup.add(new THREE.Line(dg, bracketMat))
    const dLabel = makeLabelSprite(`depth ${depthTotal.toFixed(2)} m`, '#bfdbfe')
    dLabel.position.set((minX + maxX) / 2, 0.25, bracketX)
    arrayGroup.add(dLabel)
  }

  // Auto-fit camera.
  const radius = Math.max(widthTotal, depthTotal, 1) * 1.8 + 1.5
  if (camera3 && controls3) {
    camera3.position.set(-radius, radius * 0.7, radius * 0.6)
    controls3.target.set((minX + maxX) / 2, 0.3, (minY + maxY) / 2)
    controls3.update()
  }
}

function init3d(): void {
  const mount = threeMount.value
  if (!mount || scene3) return
  const width = mount.clientWidth || 520
  const height = 360

  scene3 = new THREE.Scene()
  scene3.background = new THREE.Color(0x0b1220)

  camera3 = new THREE.PerspectiveCamera(45, width / height, 0.05, 200)
  camera3.position.set(-5, 3, 3)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(width, height)
  mount.appendChild(renderer.domElement)

  controls3 = new OrbitControls(camera3, renderer.domElement)
  controls3.enableDamping = true
  controls3.target.set(0, 0.3, 0)

  const amb = new THREE.AmbientLight(0xffffff, 0.55)
  scene3.add(amb)
  const dir = new THREE.DirectionalLight(0xffffff, 0.9)
  dir.position.set(4, 6, 3)
  scene3.add(dir)

  // Floor grid (10 m × 10 m, 1 m divisions).
  const grid = new THREE.GridHelper(10, 10, 0x334155, 0x1e293b)
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity = 0.55
  scene3.add(grid)

  // World axes: red = +x forward, blue = +z right, green = +y up.
  const axes = new THREE.AxesHelper(0.6)
  scene3.add(axes)
  // Forward arrow marker.
  const arrowMat = new THREE.LineBasicMaterial({ color: 0x3b82f6 })
  const arrowPts = [new THREE.Vector3(0, 0.01, 0), new THREE.Vector3(1, 0.01, 0)]
  const arrowGeom = new THREE.BufferGeometry().setFromPoints(arrowPts)
  scene3.add(new THREE.Line(arrowGeom, arrowMat))
  const forwardLabel = makeLabelSprite('FRONT', '#93c5fd')
  forwardLabel.position.set(1.2, 0.1, 0)
  scene3.add(forwardLabel)

  arrayGroup = new THREE.Group()
  scene3.add(arrayGroup)

  rebuildArray3d()

  const animate = (): void => {
    rafId = requestAnimationFrame(animate)
    controls3?.update()
    if (renderer && scene3 && camera3) renderer.render(scene3, camera3)
  }
  animate()

  ro = new ResizeObserver(() => {
    if (!mount || !renderer || !camera3) return
    const w = mount.clientWidth
    renderer.setSize(w, height)
    camera3.aspect = w / height
    camera3.updateProjectionMatrix()
  })
  ro.observe(mount)
}

onMounted(() => init3d())
onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  ro?.disconnect()
  controls3?.dispose()
  renderer?.dispose()
  if (renderer?.domElement.parentElement) {
    renderer.domElement.parentElement.removeChild(renderer.domElement)
  }
  renderer = null; scene3 = null; camera3 = null; controls3 = null; arrayGroup = null
})
watch([subUnits, boxW, boxH, boxD], () => rebuildArray3d(), { deep: true })
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

    <div class="card">
      <h3>Subwoofer array (polar response)</h3>
      <div class="preset-row">
        <button :class="['preset', { active: subPreset === 'endfire' }]"    @click="selectPreset('endfire')">End-fire</button>
        <button :class="['preset', { active: subPreset === 'broadside' }]"  @click="selectPreset('broadside')">Broadside</button>
        <button :class="['preset', { active: subPreset === 'cardioid2' }]"  @click="selectPreset('cardioid2')">Cardioid ×2</button>
        <button :class="['preset', { active: subPreset === 'cardioid3' }]"  @click="selectPreset('cardioid3')">Cardioid ×3</button>
        <button :class="['preset', { active: subPreset === 'arc' }]"       @click="selectPreset('arc')">Arc</button>
        <button :class="['preset', { active: subPreset === 'custom' }]"    @click="subPreset = 'custom'">Custom</button>
      </div>

      <div class="grid4">
        <label v-if="subPreset !== 'cardioid2'">Count
          <input type="number" min="2" max="8" step="1" v-model.number="subCount" @change="onCountChange" />
        </label>
        <label v-if="subPreset !== 'broadside' && subPreset !== 'arc' && subPreset !== 'custom'">Spacing (m)
          <input type="number" min="0.1" step="0.05" v-model.number="subSpacing" @change="onSpacingChange" />
        </label>
        <label v-else-if="subPreset !== 'custom'">Spacing (m)
          <input type="number" min="0.1" step="0.05" v-model.number="subSpacing" @change="onSpacingChange" />
        </label>
        <label v-if="subPreset === 'arc'">Splay (°)
          <input type="number" min="0" max="45" step="1" v-model.number="subSplayDeg" @change="onSplayChange" />
        </label>
        <label>Analysis freq (Hz)
          <input type="number" min="20" max="250" step="1" v-model.number="subFreq" />
        </label>
      </div>

      <div class="polar-row">
        <svg class="polar" viewBox="-130 -130 260 260">
          <circle v-for="r in polarRings" :key="r.db" :r="r.r" cx="0" cy="0" fill="none"
                  :stroke="r.db === 0 ? 'var(--accent)' : 'var(--border)'"
                  :stroke-opacity="r.db === 0 ? 0.6 : 0.3" stroke-width="0.5" />
          <line v-for="a in [0, 45, 90, 135]" :key="a"
                :x1="-POLAR_R * Math.cos(a * Math.PI / 180)" :y1="POLAR_R * Math.sin(a * Math.PI / 180)"
                :x2="POLAR_R * Math.cos(a * Math.PI / 180)"  :y2="-POLAR_R * Math.sin(a * Math.PI / 180)"
                stroke="var(--border)" stroke-opacity="0.3" stroke-width="0.4" />
          <text x="115" y="4" font-size="9" fill="var(--fg-dim)">0°</text>
          <text x="-125" y="4" font-size="9" fill="var(--fg-dim)">180°</text>
          <text x="-8" y="-115" font-size="9" fill="var(--fg-dim)">90°</text>
          <text x="-14" y="124" font-size="9" fill="var(--fg-dim)">270°</text>
          <path :d="polarPath" fill="var(--accent)" fill-opacity="0.18" stroke="var(--accent)" stroke-width="1.4" />
        </svg>

        <div class="polar-side">
          <div class="readout">
            forward <strong>{{ fmt(subFwd, 1) }} dB</strong> ·
            rear <strong>{{ fmt(subRear, 1) }} dB</strong>
            <br />
            front-to-back <strong>{{ fmt(subFb, 1) }} dB</strong> at {{ subFreq }} Hz
          </div>

          <svg class="sub-plan" :viewBox="subPlanViewBox" preserveAspectRatio="xMidYMid meet">
            <line x1="-10" y1="0" x2="10" y2="0" stroke="var(--border)" stroke-width="0.02" />
            <line x1="0" y1="-10" x2="0" y2="10" stroke="var(--border)" stroke-width="0.02" />
            <!-- Forward direction marker -->
            <path d="M1.5,-0.15 L1.9,0 L1.5,0.15 Z" fill="var(--accent)" opacity="0.8" />
            <g v-for="(u, i) in subUnits" :key="i">
              <circle :cx="u.x" :cy="-u.y" r="0.18"
                      :fill="u.polarity === 1 ? 'var(--accent)' : '#f43f5e'"
                      stroke="white" stroke-width="0.02" />
              <text :x="u.x" :y="-u.y - 0.28" text-anchor="middle" font-size="0.2" fill="var(--fg-dim)">
                {{ i + 1 }}
              </text>
            </g>
          </svg>
        </div>
      </div>

      <div v-if="subPreset === 'custom'" class="custom-list">
        <div class="custom-head">
          <strong>Custom units</strong>
          <button class="ghost xs" @click="addCustomUnit">+ unit</button>
        </div>
        <div v-for="(u, i) in subUnits" :key="i" class="custom-row">
          <span class="mono tag">{{ i + 1 }}</span>
          <label class="inline">x
            <input type="number" step="0.05" :value="u.x"
                   @input="updateCustomUnit(i, { x: +($event.target as HTMLInputElement).value })" />
          </label>
          <label class="inline">y
            <input type="number" step="0.05" :value="u.y"
                   @input="updateCustomUnit(i, { y: +($event.target as HTMLInputElement).value })" />
          </label>
          <label class="inline">delay ms
            <input type="number" step="0.1" :value="(u.delay * 1000).toFixed(2)"
                   @input="updateCustomUnit(i, { delay: +($event.target as HTMLInputElement).value / 1000 })" />
          </label>
          <label class="inline">gain
            <input type="number" step="0.1" min="0" :value="u.gain ?? 1"
                   @input="updateCustomUnit(i, { gain: +($event.target as HTMLInputElement).value })" />
          </label>
          <button
            :class="['pol', { inv: u.polarity === -1 }]"
            @click="updateCustomUnit(i, { polarity: u.polarity === 1 ? -1 : 1 })"
            :title="u.polarity === 1 ? 'In phase — click to invert' : 'Inverted — click to restore'"
          >{{ u.polarity === 1 ? '+' : '−' }}</button>
          <button class="ghost icon" @click="removeCustomUnit(i)" title="Remove">✕</button>
        </div>
      </div>

      <p class="muted">
        Plan view: green dots are same-polarity units, red are inverted. Arrow marks forward.
        The polar shows dB attenuation from the coherent-sum peak (outer ring = 0 dB, centre = −30 dB).
      </p>

      <div class="coverage-head">
        <strong>2D coverage (near-field, {{ subFreq }} Hz)</strong>
        <label class="inline">field size (m)
          <input type="number" min="3" max="40" step="1" v-model.number="covExtent" />
        </label>
      </div>
      <div class="coverage-wrap">
        <canvas ref="coverageCanvas" class="coverage-canvas" width="520" height="520"></canvas>
        <div class="cov-legend">
          <div class="cov-bar"></div>
          <div class="cov-ticks">
            <span>+6 dB</span>
            <span>0</span>
            <span>−10</span>
            <span>−20</span>
            <span>−30</span>
          </div>
        </div>
      </div>
      <p class="muted">
        Each pixel sums the complex pressure contribution from every unit at that
        point (spherical spreading, propagation delay, applied delay and polarity).
        Reds / yellows = constructive summation; blue / black = cancellation.
      </p>

      <div class="coverage-head">
        <strong>3D array layout</strong>
        <div class="box-dims">
          <label class="inline">W
            <input type="number" min="0.2" max="1.5" step="0.01" v-model.number="boxW" />
          </label>
          <label class="inline">H
            <input type="number" min="0.2" max="1.5" step="0.01" v-model.number="boxH" />
          </label>
          <label class="inline">D
            <input type="number" min="0.2" max="1.5" step="0.01" v-model.number="boxD" />
          </label>
          <span class="muted dim-hint">cabinet (m)</span>
        </div>
      </div>
      <div ref="threeMount" class="three-mount"></div>
      <p class="muted">
        Each box represents one cabinet ({{ boxW.toFixed(2) }} × {{ boxH.toFixed(2) }} × {{ boxD.toFixed(2) }} m).
        Green = in-phase, red = inverted polarity. Yellow dashed lines mark
        centre-to-centre spacing; blue brackets show total footprint width &amp; depth.
        The dark face on each cabinet is the front (driver) side. Drag to rotate, scroll to zoom.
      </p>
    </div>
  </div>
</template>

<style scoped>
.calcs { display: flex; flex-direction: column; gap: 14px; max-width: 960px; margin: 0 auto; }
.card { padding: 14px 16px; }
.credit { border-left: 3px solid var(--accent); }
.credit a { color: var(--accent); }
h3 { margin: 0 0 10px 0; color: var(--accent); }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: end; margin-bottom: 8px; }
.grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; align-items: end; margin-bottom: 8px; }
.grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; align-items: end; margin-bottom: 10px; }
label { display: flex; flex-direction: column; font-size: 12px; color: var(--fg-dim); gap: 4px; }
input { padding: 5px 8px; }
.readout { padding: 8px 10px; background: var(--bg-2); border-radius: var(--radius-sm); font-size: 13px; }
.readout strong { color: var(--fg); }
.muted { color: var(--fg-dim); font-size: 12px; margin: 4px 0 0 0; }
table.absorb { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 13px; }
table.absorb th, table.absorb td { text-align: right; padding: 4px 8px; border-bottom: 1px solid var(--border); }
table.absorb th:first-child, table.absorb td:first-child { text-align: left; }
.fb-plot { width: 100%; height: 160px; background: var(--bg-2); border-radius: var(--radius-sm); }

.preset-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.preset {
  padding: 6px 12px; border: 1px solid var(--border); background: var(--bg-2);
  color: var(--fg-dim); border-radius: var(--radius-sm); cursor: pointer; font-size: 12px;
}
.preset:hover { color: var(--fg); border-color: var(--accent); }
.preset.active { background: var(--accent); color: var(--bg); border-color: var(--accent); }

.polar-row { display: grid; grid-template-columns: 260px 1fr; gap: 16px; align-items: start; margin: 6px 0; }
.polar { width: 260px; height: 260px; background: var(--bg-2); border-radius: var(--radius-sm); }
.polar-side { display: flex; flex-direction: column; gap: 10px; }
.sub-plan { width: 100%; height: 180px; background: var(--bg-2); border-radius: var(--radius-sm); }

.custom-list { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; padding: 10px; background: var(--bg-2); border-radius: var(--radius-sm); }
.custom-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.custom-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12px; }
.custom-row .inline { flex-direction: row; align-items: center; gap: 4px; }
.custom-row .inline input { width: 70px; }
.custom-row .tag { padding: 2px 6px; background: var(--bg); border-radius: var(--radius-sm); font-size: 11px; color: var(--fg-dim); }
.pol {
  width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--accent);
  background: var(--accent); color: var(--bg); cursor: pointer; font-weight: bold;
}
.pol.inv { background: #f43f5e; border-color: #f43f5e; }
.ghost { background: transparent; border: 1px solid var(--border); color: var(--fg-dim); padding: 4px 8px; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; }
.ghost:hover { color: var(--fg); border-color: var(--accent); }
.ghost.xs { padding: 2px 6px; font-size: 11px; }
.ghost.icon { padding: 4px 8px; }

.coverage-head { display: flex; justify-content: space-between; align-items: center; margin: 14px 0 8px 0; }
.coverage-head .inline { flex-direction: row; gap: 6px; align-items: center; font-size: 12px; }
.coverage-head .inline input { width: 70px; }
.coverage-wrap { display: grid; grid-template-columns: 1fr 56px; gap: 10px; align-items: stretch; }
.coverage-canvas {
  width: 100%; max-width: 520px; aspect-ratio: 1 / 1; height: auto;
  background: #0b1220; border-radius: var(--radius-sm); display: block;
}
.cov-legend { display: flex; gap: 6px; align-items: stretch; }
.cov-bar {
  width: 14px; border-radius: 3px;
  background: linear-gradient(to top, #18243e 0%, #2563eb 25%, #22c55e 50%, #eab308 75%, #ef4444 100%);
}
.cov-ticks {
  display: flex; flex-direction: column; justify-content: space-between;
  font-size: 10px; color: var(--fg-dim);
}

.three-mount {
  width: 100%; height: 360px; background: #0b1220;
  border-radius: var(--radius-sm); overflow: hidden; margin-top: 4px;
}
.box-dims { display: flex; gap: 8px; align-items: center; }
.box-dims .inline { flex-direction: row; gap: 4px; align-items: center; font-size: 12px; }
.box-dims .inline input { width: 64px; }
.dim-hint { font-size: 11px; margin-left: 4px; }

@media (max-width: 720px) {
  .polar-row { grid-template-columns: 1fr; }
  .polar { margin: 0 auto; }
  .coverage-wrap { grid-template-columns: 1fr 48px; }
}
</style>

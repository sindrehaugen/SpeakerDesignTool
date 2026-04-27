<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useSubArrayStore } from '@/stores/subArray'
import { useDatabaseStore } from '@/stores/database'
import { useRoomStore } from '@/stores/room'
import { useUiStore } from '@/stores/ui'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const store = useSubArrayStore()
const db = useDatabaseStore()

const threeMount = ref<HTMLElement | null>(null)
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls

const globalSpeaker = ref<string>('')

function renameArray() {
  const newName = prompt('Enter new name for array:', store.activeArray.name)
  if (newName !== null) {
    store.renameActiveArray(newName)
  }
}

function exportToRoom() {
  const roomStore = useRoomStore()
  const uiStore = useUiStore()
  
  store.units.forEach((u, i) => {
    let sens = 96
    if (u.speakerId && db.data.speakers[u.speakerId]) {
      sens = db.data.speakers[u.speakerId]!.sensitivity ?? 96
    }
    
    let yaw = 0
    if (store.config.preset === 'arc') {
      const splayRad = (store.config.splayDeg * Math.PI) / 180
      const offset = (store.config.count - 1) / 2
      yaw = -(i - offset) * splayRad
    }
    
    roomStore.addSpeaker({
      nodeId: `sub-${store.activeArray.id}-${i}`,
      mount: 'stand',
      x: u.y, // Sub +y (right) -> Room +x
      y: 1.0 + u.x, // Sub +x (forward) -> Room +y (into room from front wall)
      z: store.config.boxH / 2,
      yawDeg: 90 + (yaw * 180 / Math.PI), // Room yaw=90 is +y
      pitchDeg: 0,
      halfAngle: 180, // Subs are essentially omni
      sensitivity: sens,
      powerW: 500 * (u.gain ?? 1),
    })
  })
  
  uiStore.currentView = 'room'
}

watch(globalSpeaker, (val) => {
  if (val) store.assignSpeakerToAll(val)
})

function initThree() {
  if (!threeMount.value) return
  const el = threeMount.value
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#0b1220')

  camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 100)
  camera.position.set(5, 5, 5)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(el.clientWidth, el.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.1

  const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b)
  scene.add(grid)
  
  const axes = new THREE.AxesHelper(2)
  scene.add(axes)

  const light = new THREE.DirectionalLight(0xffffff, 1)
  light.position.set(5, 10, 5)
  scene.add(light)
  scene.add(new THREE.AmbientLight(0x404040))

  renderScene()
  
  const animate = () => {
    requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()
}

const boxes: THREE.Mesh[] = []

function renderScene() {
  if (!scene) return
  boxes.forEach(b => scene.remove(b))
  boxes.length = 0

  const { units, boxW, boxH, boxD } = store.config

  const matPos = new THREE.MeshStandardMaterial({ color: 0x22c55e })
  const matNeg = new THREE.MeshStandardMaterial({ color: 0xef4444 })
  const matFace = new THREE.MeshStandardMaterial({ color: 0x111827 })

  units.forEach((u) => {
    const geo = new THREE.BoxGeometry(boxD, boxH, boxW)
    const mat = u.polarity > 0 ? matPos : matNeg
    const mesh = new THREE.Mesh(geo, [mat, mat, mat, mat, matFace, mat])
    // The driver (matFace) is on the +x face (index 4)
    mesh.position.set(u.x, boxH / 2, u.y)
    // Rotate to point driver forward. If arc array, add rotation.
    let yaw = 0
    if (store.config.preset === 'arc') {
      const splayRad = (store.config.splayDeg * Math.PI) / 180
      const offset = (store.config.count - 1) / 2
      const idx = units.indexOf(u)
      yaw = -(idx - offset) * splayRad
    }
    mesh.rotation.y = yaw
    scene.add(mesh)
    boxes.push(mesh)
  })
}

watch(() => store.config, renderScene, { deep: true })

onMounted(() => {
  initThree()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  renderer?.dispose()
})

function handleResize() {
  if (!threeMount.value || !camera || !renderer) return
  const el = threeMount.value
  camera.aspect = el.clientWidth / el.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(el.clientWidth, el.clientHeight)
}
</script>

<template>
  <div class="calcs">
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3>Subwoofer Array Designer</h3>
        
        <div style="display: flex; gap: 8px; align-items: center;">
          <select :value="store.state.activeId" @change="e => store.switchArray((e.target as HTMLSelectElement).value)" style="font-weight: bold;">
            <option v-for="arr in store.state.arrays" :key="arr.id" :value="arr.id">{{ arr.name }}</option>
          </select>
          <button class="ghost icon" @click="renameArray" title="Rename Array">✏️</button>
          <button class="ghost icon" @click="store.duplicateActiveArray()" title="Duplicate Array">📄</button>
          <button class="ghost icon" @click="store.createNewArray()" title="New Array">➕</button>
          <button class="ghost icon" @click="store.deleteActiveArray()" title="Delete Array" :disabled="store.state.arrays.length <= 1" style="color: #f43f5e;">🗑️</button>
          <button class="preset" @click="exportToRoom" style="margin-left: 10px;" title="Export array units to the 3D Room simulation">🚀 Export to Room</button>
        </div>
      </div>
      
      <div class="preset-row">
        <button :class="['preset', { active: store.config.preset === 'endfire' }]" @click="store.selectPreset('endfire')">Inline End-fire</button>
        <button :class="['preset', { active: store.config.preset === 'broadside' }]" @click="store.selectPreset('broadside')">Broadside</button>
        <button :class="['preset', { active: store.config.preset === 'cardioid2' }]" @click="store.selectPreset('cardioid2')">2-element Cardioid</button>
        <button :class="['preset', { active: store.config.preset === 'cardioid3' }]" @click="store.selectPreset('cardioid3')">3-element Cardioid</button>
        <button :class="['preset', { active: store.config.preset === 'arc' }]" @click="store.selectPreset('arc')">Physical Arc</button>
        <button :class="['preset', { active: store.config.preset === 'custom' }]" disabled>Custom</button>
      </div>

      <div class="grid4">
        <label>Elements
          <input type="number" min="1" max="16" :value="store.config.count" @change="e => store.setCount(Number((e.target as HTMLInputElement).value))" :disabled="['cardioid2','cardioid3','custom'].includes(store.config.preset)" />
        </label>
        <label>Spacing (m)
          <input type="number" min="0.1" max="10" step="0.1" :value="store.config.spacing" @change="e => store.setSpacing(Number((e.target as HTMLInputElement).value))" :disabled="store.config.preset === 'custom'" />
        </label>
        <label>Frequency (Hz)
          <input type="number" min="20" max="250" v-model.number="store.config.analysisFreq" />
        </label>
        <label v-if="store.config.preset === 'arc'">Splay (deg)
          <input type="number" min="0" max="45" step="1" :value="store.config.splayDeg" @change="e => store.setSplay(Number((e.target as HTMLInputElement).value))" />
        </label>
      </div>

      <div class="polar-row">
        <div class="polar-side">
          <div class="readout">
            <div style="display: flex; justify-content: space-between;">
              <span>Forward:</span> <strong>{{ store.forwardDb > -99 ? store.forwardDb.toFixed(1) : '-∞' }} dB</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Rear (180°):</span> <strong>{{ store.rearDb > -99 ? store.rearDb.toFixed(1) : '-∞' }} dB</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border); margin-top: 4px; padding-top: 4px;">
              <span>Rejection:</span> <strong>{{ store.fbRatio.toFixed(1) }} dB</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="custom-list">
        <div class="custom-head">
          <strong style="font-size: 13px;">Array Configuration</strong>
          <div style="display: flex; gap: 8px; align-items: center;">
            <label class="inline" style="flex-direction: row; margin: 0; align-items: center;">
              Global Speaker:
              <select v-model="globalSpeaker">
                <option value="">-- None --</option>
                <option v-for="spk in db.data.speakers" :key="spk.id" :value="spk.id">{{ spk.brand }} {{ spk.model }}</option>
              </select>
            </label>
            <button class="ghost xs" @click="store.addUnit()">+ Add Unit</button>
          </div>
        </div>
        <div class="custom-row" v-for="(u, i) in store.units" :key="i">
          <span class="tag">#{{ i + 1 }}</span>
          <label class="inline">X: <input type="number" step="0.1" :value="u.x" @change="e => store.updateUnit(i, { x: Number((e.target as HTMLInputElement).value) })" /></label>
          <label class="inline">Y: <input type="number" step="0.1" :value="u.y" @change="e => store.updateUnit(i, { y: Number((e.target as HTMLInputElement).value) })" /></label>
          <label class="inline">Delay: <input type="number" step="0.001" :value="u.delay" @change="e => store.updateUnit(i, { delay: Number((e.target as HTMLInputElement).value) })" /></label>
          <label class="inline">Gain: <input type="number" step="0.1" :value="u.gain" @change="e => store.updateUnit(i, { gain: Number((e.target as HTMLInputElement).value) })" /></label>
          
          <button :class="['pol', { inv: u.polarity < 0 }]" @click="store.updateUnit(i, { polarity: u.polarity < 0 ? 1 : -1 as any })" title="Toggle Polarity">
            {{ u.polarity > 0 ? '+' : '−' }}
          </button>
          
          <label class="inline">Speaker:
            <select :value="u.speakerId || ''" @change="e => store.assignSpeaker(i, (e.target as HTMLSelectElement).value)">
              <option value="">-- None --</option>
              <option v-for="spk in db.data.speakers" :key="spk.id" :value="spk.id">{{ spk.brand }} {{ spk.model }}</option>
            </select>
          </label>

          <button class="ghost icon" @click="store.removeUnit(i)" title="Remove" :disabled="store.units.length <= 1">✕</button>
        </div>
      </div>

      <div class="coverage-head">
        <strong>3D array layout</strong>
        <div class="box-dims">
          <label class="inline">W <input type="number" min="0.2" max="1.5" step="0.01" v-model.number="store.config.boxW" /></label>
          <label class="inline">H <input type="number" min="0.2" max="1.5" step="0.01" v-model.number="store.config.boxH" /></label>
          <label class="inline">D <input type="number" min="0.2" max="1.5" step="0.01" v-model.number="store.config.boxD" /></label>
          <span class="muted dim-hint">cabinet (m)</span>
        </div>
      </div>
      <div ref="threeMount" class="three-mount"></div>
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

h3 {
  margin: 0 0 8px 0;
  color: var(--fg);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-soft);
}

/* Form grid — dense, technical */
.grid4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  align-items: end;
  margin-bottom: 10px;
  padding: 8px;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
}
label {
  display: flex;
  flex-direction: column;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
  gap: 3px;
}
input, select {
  padding: 3px 6px;
  height: 24px;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--fg);
  border-radius: var(--radius-sm);
  font-size: 12px;
}
input[type="number"] {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* Numeric meter readout — SPL / dB block */
.readout {
  padding: 8px 10px;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-left: 2px solid var(--accent);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  line-height: 1.7;
}
.readout strong { color: var(--accent); font-weight: 600; }
.readout :deep(span) {
  font-family: var(--font-sans);
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
}
.muted { color: var(--fg-subtle); font-size: 11px; margin: 4px 0 0 0; }

/* Preset selector — segmented toolbar */
.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-bottom: 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 2px;
}
.preset {
  padding: 4px 10px;
  height: 24px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--fg-dim);
  border-radius: 2px;
  cursor: pointer;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  transition: color 80ms linear, background 80ms linear;
}
.preset:hover:not(:disabled) { color: var(--fg); background: var(--bg-2); }
.preset.active {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent-line);
}
.preset:disabled { opacity: 0.3; cursor: not-allowed; }

.polar-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  align-items: start;
  margin: 6px 0;
}
.polar-side { display: flex; flex-direction: column; gap: 8px; }

/* Unit list — channel-strip aesthetic */
.custom-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 10px;
  padding: 0;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.custom-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  height: 28px;
  background: linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%);
  border-bottom: 1px solid var(--border);
}
.custom-head strong {
  font-size: 10px !important;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  color: var(--fg);
}
.custom-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 4px 8px;
  font-size: 11px;
  border-bottom: 1px solid var(--border-soft);
  font-family: var(--font-mono);
}
.custom-row:last-child { border-bottom: 0; }
.custom-row:hover { background: var(--bg-2); }
.custom-row .inline {
  flex-direction: row;
  align-items: center;
  gap: 4px;
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.06em;
}
.custom-row .inline input { width: 64px; height: 22px; }
.custom-row .inline select { height: 22px; font-size: 11px; }
.custom-row .tag {
  padding: 1px 6px;
  background: var(--bg-2);
  border: 1px solid var(--border-soft);
  border-radius: 2px;
  font-size: 10px;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.05em;
}

/* Polarity toggle — round phase indicator */
.pol {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--accent-line);
  background: var(--accent-soft);
  color: var(--accent);
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.pol.inv {
  background: rgba(244,63,94,0.12);
  border-color: rgba(244,63,94,0.45);
  color: var(--error);
}

.ghost {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--fg-dim);
  padding: 0 8px;
  height: 22px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 11px;
}
.ghost:hover { color: var(--fg); border-color: var(--border-strong); background: var(--bg-2); }
.ghost.xs { padding: 0 6px; height: 20px; font-size: 10px; }

.coverage-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 12px 0 6px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-soft);
}
.coverage-head strong {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  color: var(--fg);
}
.box-dims { display: flex; gap: 6px; align-items: center; }
.box-dims .inline {
  flex-direction: row;
  gap: 4px;
  align-items: center;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
}
.box-dims .inline input { width: 56px; height: 22px; }
.dim-hint { font-family: var(--font-mono); font-size: 10px; color: var(--fg-subtle); }

/* 3D viewport — instrument frame */
.three-mount {
  width: 100%;
  height: 380px;
  background:
    radial-gradient(ellipse at center, #0b1220 0%, #050810 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-top: 4px;
  box-shadow: inset 0 0 24px rgba(0,0,0,0.6);
  position: relative;
}
.three-mount::before {
  content: "3D · ARRAY VIEW";
  position: absolute;
  top: 6px;
  left: 8px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--accent);
  opacity: 0.7;
  pointer-events: none;
  z-index: 1;
}
</style>

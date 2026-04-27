<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from 'vue'
import * as THREE from 'three'
import { useRoomStore, type SpeakerPlacement, type Obstacle, type Slope, type SpeakerMount, type Listener } from '@/stores/room'
import { useProjectStore } from '@/stores/project'
import { useDatabaseStore } from '@/stores/database'
import { stiRating, widthRange, floorAt, ceilingAt } from '@/core/room'
import type { RoomGeometry } from '@/core/room'

const room = useRoomStore()
const project = useProjectStore()
const database = useDatabaseStore()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const heatEl = ref<HTMLCanvasElement | null>(null)

type Tab = 'room' | 'speakers' | 'obstacles' | 'slopes' | 'listeners'
const activeTab = ref<Tab>('room')
const TABS: Array<{ id: Tab; label: string; count?: () => number }> = [
  { id: 'room',      label: 'Room' },
  { id: 'speakers',  label: 'Speakers',  count: () => room.speakers.length },
  { id: 'obstacles', label: 'Obstacles', count: () => room.obstacles.length },
  { id: 'slopes',    label: 'Slopes',    count: () => room.slopes.length },
  { id: 'listeners', label: 'Listeners', count: () => room.listeners.length },
]

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let speakerGroup: THREE.Group | null = null
let obstacleGroup: THREE.Group | null = null
let slopeGroup: THREE.Group | null = null
let roomGroup: THREE.Group | null = null
let listenerGroup: THREE.Group | null = null
let coverageGroup: THREE.Group | null = null
let heatmapGroup: THREE.Group | null = null
let heatmapTexture: THREE.CanvasTexture | null = null
let animId = 0
let yaw = Math.PI / 4
let pitch = Math.PI / 6
let dist = 20

const MOUNT_OPTIONS: Array<{ v: SpeakerMount; label: string; defaultPitch: number }> = [
  { v: 'ceiling', label: 'Ceiling', defaultPitch: 90 },
  { v: 'wall',    label: 'Wall',    defaultPitch: 15 },
  { v: 'pendant', label: 'Pendant', defaultPitch: 90 },
  { v: 'stand',   label: 'Stand',   defaultPitch: 0 },
]

const nodeOptions = computed(() =>
  project.allNodes.map((n) => ({
    id: n.id,
    label: `${n.id} — ${n.speakerId || '(no speaker)'}`,
    speakerId: n.speakerId,
    tapPower: n.tapPower,
  })),
)

/** Plan-view centre of the (centred) trapezoid footprint. */
function planCentre(g: RoomGeometry): { cx: number; cy: number } {
  const cx = Math.max(g.frontWidth, g.rearWidth) / 2
  return { cx, cy: g.depth / 2 }
}

/** Eight corners of the room shell in world coords. */
function roomCorners(g: RoomGeometry) {
  const [fxL, fxR] = widthRange(g, 0)
  const [rxL, rxR] = widthRange(g, g.depth)
  return {
    FLF: [fxL, 0,        g.floorFrontZ],
    FRF: [fxR, 0,        g.floorFrontZ],
    RLF: [rxL, g.depth,  g.floorRearZ],
    RRF: [rxR, g.depth,  g.floorRearZ],
    FLC: [fxL, 0,        g.ceilingFrontZ],
    FRC: [fxR, 0,        g.ceilingFrontZ],
    RLC: [rxL, g.depth,  g.ceilingRearZ],
    RRC: [rxR, g.depth,  g.ceilingRearZ],
  } as Record<string, [number, number, number]>
}

/** Convert world (x, y, z) to Three.js (x, z, y) — z is up in world, y in Three. */
function toThree(p: [number, number, number]): [number, number, number] {
  return [p[0], p[2], p[1]]
}

function disposeGroup(g: THREE.Group): void {
  for (const child of g.children) {
    const mesh = child as THREE.Mesh | THREE.Line | THREE.LineSegments
    if (mesh.geometry) mesh.geometry.dispose()
  }
  g.clear()
}

function quadMesh(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  d: [number, number, number],
  color: number,
  opacity: number,
): THREE.Mesh {
  const positions = new Float32Array([...a, ...b, ...c, ...d])
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geom.setIndex([0, 1, 2, 0, 2, 3])
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: THREE.DoubleSide,
  })
  return new THREE.Mesh(geom, mat)
}

function lineSegs(pts: number[], color: number): THREE.LineSegments {
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color }))
}

function addGeometry(): void {
  if (!scene || !roomGroup) return
  disposeGroup(roomGroup)
  const g = room.geometry
  const c = roomCorners(g)

  // Sloped floor + ceiling as translucent quads.
  const floor = quadMesh(
    toThree(c['FLF']!), toThree(c['FRF']!), toThree(c['RRF']!), toThree(c['RLF']!),
    0x27272a, 0.75,
  )
  roomGroup.add(floor)
  const ceiling = quadMesh(
    toThree(c['FLC']!), toThree(c['FRC']!), toThree(c['RRC']!), toThree(c['RLC']!),
    0x3f3f46, 0.15,
  )
  roomGroup.add(ceiling)

  // 12 edges of the hexahedron.
  const pairs: Array<[string, string]> = [
    ['FLF', 'FRF'], ['FRF', 'RRF'], ['RRF', 'RLF'], ['RLF', 'FLF'],
    ['FLC', 'FRC'], ['FRC', 'RRC'], ['RRC', 'RLC'], ['RLC', 'FLC'],
    ['FLF', 'FLC'], ['FRF', 'FRC'], ['RRF', 'RRC'], ['RLF', 'RLC'],
  ]
  const edgePts: number[] = []
  for (const [a, b] of pairs) {
    edgePts.push(...toThree(c[a]!), ...toThree(c[b]!))
  }
  roomGroup.add(lineSegs(edgePts, 0x71717a))

  // Grid aligned with the listener plane, covering max extents.
  const span = Math.max(g.frontWidth, g.rearWidth, g.depth)
  const grid = new THREE.GridHelper(span, Math.round(span))
  const { cx, cy } = planCentre(g)
  grid.position.set(cx, Math.min(g.floorFrontZ, g.floorRearZ) + 0.01, cy)
  ;(grid.material as THREE.Material).opacity = 0.22
  ;(grid.material as THREE.Material).transparent = true
  roomGroup.add(grid)
}

function mountColor(m: SpeakerMount): number {
  switch (m) {
    case 'ceiling': return 0x10b981
    case 'wall':    return 0x3b82f6
    case 'pendant': return 0xa855f7
    case 'stand':   return 0xf59e0b
  }
}

const CONE_AXIS = new THREE.Vector3(0, 1, 0)
function addSpeakers(): void {
  if (!scene || !speakerGroup) return
  disposeGroup(speakerGroup)
  const sources = room.sources
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i]!
    const placement = room.speakers[i]
    if (!placement) continue
    const geom = new THREE.ConeGeometry(0.25, 0.6, 12)
    const mat = new THREE.MeshBasicMaterial({ color: mountColor(placement.mount) })
    const cone = new THREE.Mesh(geom, mat)
    cone.position.set(s.x, s.z, s.y)
    const aim = s.aim!
    const target = new THREE.Vector3(aim.x, aim.z, aim.y)
    if (target.lengthSq() > 1e-12) {
      target.normalize()
      cone.quaternion.setFromUnitVectors(CONE_AXIS.clone().negate(), target)
    }
    speakerGroup.add(cone)
  }
}

function addObstacles(): void {
  if (!scene || !obstacleGroup) return
  disposeGroup(obstacleGroup)
  for (const o of room.obstacles) {
    const geom = new THREE.BoxGeometry(o.width, o.height, o.depth)
    if (o.kind === 'stage') {
      const mat = new THREE.MeshBasicMaterial({ color: 0xb45309, transparent: true, opacity: 0.55 })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.set(o.x + o.width / 2, o.z + o.height / 2, o.y + o.depth / 2)
      obstacleGroup.add(mesh)
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geom),
        new THREE.LineBasicMaterial({ color: 0xf59e0b }),
      )
      edges.position.copy(mesh.position)
      obstacleGroup.add(edges)
    } else {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geom),
        new THREE.LineBasicMaterial({ color: 0xef4444 }),
      )
      edges.position.set(o.x + o.width / 2, o.z + o.height / 2, o.y + o.depth / 2)
      obstacleGroup.add(edges)
    }
  }
}

function addSlopes(): void {
  if (!scene || !slopeGroup) return
  disposeGroup(slopeGroup)
  for (const s of room.slopes) {
    if (!Number.isFinite(s.length) || s.length < 1e-3) continue
    if (!Number.isFinite(s.cx) || !Number.isFinite(s.cy)) continue
    if (!Number.isFinite(s.zLow) || !Number.isFinite(s.zHigh)) continue

    const theta = (s.rotationDeg * Math.PI) / 180
    const c = Math.cos(theta)
    const sn = Math.sin(theta)
    const hL = s.length / 2
    const hWLow = Math.max(0, s.widthLow) / 2
    const hWHigh = Math.max(0, s.widthHigh) / 2
    const toWorld = (lx: number, ly: number, lz: number): [number, number, number] => {
      const wx = s.cx + lx * c - ly * sn
      const wy = s.cy + lx * sn + ly * c
      return [wx, lz, wy]
    }
    const verts: Array<[number, number, number]> = [
      toWorld(-hL, -hWLow, s.zLow),
      toWorld(-hL, +hWLow, s.zLow),
      toWorld(+hL, +hWHigh, s.zHigh),
      toWorld(+hL, -hWHigh, s.zHigh),
    ]
    const flat = verts.flat()
    if (flat.some((v) => !Number.isFinite(v))) continue

    const positions = new Float32Array(flat)
    const topGeom = new THREE.BufferGeometry()
    topGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    topGeom.setIndex([0, 1, 2, 0, 2, 3])
    const topMat = new THREE.MeshBasicMaterial({
      color: 0x8b5cf6, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
    })
    slopeGroup.add(new THREE.Mesh(topGeom, topMat))

    const loopPts: number[] = []
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i]!
      const b = verts[(i + 1) % verts.length]!
      if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 1e-3) {
        loopPts.push(...a, ...b)
      }
    }
    if (loopPts.length >= 6) {
      slopeGroup.add(lineSegs(loopPts, 0xa78bfa))
    }

    const drops: number[] = []
    for (const [vx, vy, vz] of verts) {
      if (vy > 1e-3) drops.push(vx, vy, vz, vx, 0, vz)
    }
    if (drops.length >= 6) {
      const dropGeom = new THREE.BufferGeometry()
      dropGeom.setAttribute('position', new THREE.Float32BufferAttribute(drops, 3))
      slopeGroup.add(new THREE.LineSegments(dropGeom, new THREE.LineBasicMaterial({ color: 0x6d28d9, transparent: true, opacity: 0.6 })))
    }
  }
}

function addListeners(): void {
  if (!scene || !listenerGroup) return
  disposeGroup(listenerGroup)
  for (const r of room.listenerReadings) {
    const sphereGeom = new THREE.SphereGeometry(0.14, 10, 8)
    const mat = new THREE.MeshBasicMaterial({ color: 0xf43f5e })
    const sphere = new THREE.Mesh(sphereGeom, mat)
    sphere.position.set(r.x, r.z, r.y)
    listenerGroup.add(sphere)
    const floor = floorAt(room.geometry, r.y)
    if (r.z > floor + 0.02) {
      const rodGeom = new THREE.BufferGeometry()
      rodGeom.setAttribute('position', new THREE.Float32BufferAttribute(
        [r.x, floor, r.y, r.x, r.z, r.y], 3,
      ))
      listenerGroup.add(new THREE.LineSegments(
        rodGeom, new THREE.LineBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.55 }),
      ))
    }
  }
}

/** Radius at the listener plane for a cone of `halfAngle` aimed along `aim` from (sx, sy, sz),
 *  projected to a plane at z = targetZ. Returns null if the cone doesn't reach the plane. */
function coverageRadius(sx: number, sy: number, sz: number, aim: { x: number; y: number; z: number }, halfAngle: number, targetZ: number): number | null {
  const dz = targetZ - sz
  const mag = Math.hypot(aim.x, aim.y, aim.z)
  if (mag < 1e-6) return null
  const az = aim.z / mag
  if (Math.abs(az) < 1e-3) return null
  const slant = dz / az
  if (slant <= 0) return null
  return slant * Math.tan((halfAngle * Math.PI) / 180)
}

function addCoverage(): void {
  if (!scene || !coverageGroup) return
  disposeGroup(coverageGroup)
  if (!room.show3dCoverage) return
  const g = room.geometry
  const planeZ = Math.min(g.floorFrontZ, g.floorRearZ) + room.listenerHeight
  for (let i = 0; i < room.speakers.length; i++) {
    const p = room.speakers[i]!
    const src = room.sources[i]
    if (!src || !src.aim) continue
    const radius = coverageRadius(p.x, p.y, p.z, src.aim, p.halfAngle, planeZ)
    if (radius === null || !Number.isFinite(radius) || radius < 0.05) continue
    const mag = Math.hypot(src.aim.x, src.aim.y, src.aim.z) || 1
    const cx = p.x + (src.aim.x / mag) * ((planeZ - p.z) / (src.aim.z / mag))
    const cy = p.y + (src.aim.y / mag) * ((planeZ - p.z) / (src.aim.z / mag))
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue
    const segments = 48
    const pts: number[] = []
    for (let k = 0; k <= segments; k++) {
      const a0 = (k / segments) * Math.PI * 2
      const a1 = ((k + 1) / segments) * Math.PI * 2
      pts.push(cx + radius * Math.cos(a0), planeZ + 0.02, cy + radius * Math.sin(a0))
      pts.push(cx + radius * Math.cos(a1), planeZ + 0.02, cy + radius * Math.sin(a1))
    }
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    coverageGroup.add(new THREE.LineSegments(
      geom, new THREE.LineBasicMaterial({ color: mountColor(p.mount), transparent: true, opacity: 0.7 }),
    ))
  }
}

function rebuildHeatmapTexture(): void {
  const src = heatEl.value
  if (!src || !heatmapGroup) return
  disposeGroup(heatmapGroup)
  if (!room.show3dHeatmap) return
  const g = room.geometry
  const maxWidth = Math.max(g.frontWidth, g.rearWidth)
  const planeZ = Math.min(g.floorFrontZ, g.floorRearZ) + room.listenerHeight
  heatmapTexture?.dispose()
  heatmapTexture = new THREE.CanvasTexture(src)
  heatmapTexture.needsUpdate = true
  heatmapTexture.flipY = false
  const mat = new THREE.MeshBasicMaterial({
    map: heatmapTexture, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
  })
  const geom = new THREE.PlaneGeometry(maxWidth, g.depth)
  const mesh = new THREE.Mesh(geom, mat)
  mesh.rotation.x = -Math.PI / 2
  const { cx, cy } = planCentre(g)
  mesh.position.set(cx, planeZ + 0.01, cy)
  heatmapGroup.add(mesh)
}

function updateCamera(): void {
  if (!camera) return
  const g = room.geometry
  const { cx, cy } = planCentre(g)
  const cz = (Math.min(g.floorFrontZ, g.floorRearZ) + Math.max(g.ceilingFrontZ, g.ceilingRearZ)) / 2
  camera.position.set(
    cx + dist * Math.cos(pitch) * Math.sin(yaw),
    cz + dist * Math.sin(pitch),
    cy + dist * Math.cos(pitch) * Math.cos(yaw),
  )
  camera.lookAt(cx, cz, cy)
}

function onWheel(e: WheelEvent): void {
  e.preventDefault()
  dist = Math.max(3, Math.min(80, dist + e.deltaY * 0.02))
  updateCamera()
}

let dragging = false
let lastX = 0
let lastY = 0
function onMouseDown(e: MouseEvent): void { dragging = true; lastX = e.clientX; lastY = e.clientY }
function onMouseUp(): void { dragging = false }
function onMouseMove(e: MouseEvent): void {
  if (!dragging) return
  yaw -= (e.clientX - lastX) * 0.01
  pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 2.1, pitch + (e.clientY - lastY) * 0.01))
  lastX = e.clientX; lastY = e.clientY
  updateCamera()
}

function animate(): void {
  animId = requestAnimationFrame(animate)
  renderer?.render(scene!, camera!)
}

function drawHeatmap(): void {
  const canvas = heatEl.value
  if (!canvas) return
  const g = room.geometry
  const maxWidth = Math.max(g.frontWidth, g.rearWidth)
  const res = room.heatResolution
  const nx = Math.max(2, Math.round(maxWidth * res))
  const ny = Math.max(2, Math.round(g.depth * res))
  canvas.width = nx * 20
  canvas.height = ny * 20
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const cells = room.heatmap
  const { min, max } = room.splStats
  const range = Math.max(1, max - min)
  const cellW = canvas.width / nx
  const cellH = canvas.height / ny
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const cell = cells[j * nx + i]
      if (!cell) continue
      if (!isFinite(cell.spl)) {
        ctx.fillStyle = '#18181b'
        ctx.fillRect(i * cellW, (ny - 1 - j) * cellH, cellW + 1, cellH + 1)
        continue
      }
      const t = Math.max(0, Math.min(1, (cell.spl - min) / range))
      ctx.fillStyle = heatColor(t)
      ctx.fillRect(i * cellW, (ny - 1 - j) * cellH, cellW + 1, cellH + 1)
    }
  }
}

function heatColor(t: number): string {
  const r = Math.round(255 * Math.min(1, 2 * t))
  const g = Math.round(255 * Math.min(1, 2 * (1 - Math.abs(t - 0.5))))
  const b = Math.round(255 * Math.min(1, 2 * (1 - t)))
  return `rgb(${r},${g},${b})`
}

function addPlacement(mount: SpeakerMount = 'ceiling'): void {
  const g = room.geometry
  const defaultPitch = MOUNT_OPTIONS.find((m) => m.v === mount)?.defaultPitch ?? 90
  const midY = g.depth / 2
  const ceilMid = ceilingAt(g, midY)
  const floorMid = floorAt(g, midY)
  const defaultZ =
    mount === 'ceiling' ? ceilMid - 0.1 :
    mount === 'pendant' ? Math.min(floorMid + 2.5, ceilMid - 0.5) :
    mount === 'wall'    ? floorMid + 2.4 :
                          floorMid + 1.2
  const { cx } = planCentre(g)
  const p: SpeakerPlacement = {
    nodeId: '',
    mount,
    x: cx,
    y: midY,
    z: defaultZ,
    yawDeg: 0,
    pitchDeg: defaultPitch,
    sensitivity: 88,
    powerW: 20,
    halfAngle: 60,
  }
  room.addSpeaker(p)
  activeTab.value = 'speakers'
}

function linkNode(index: number, nodeId: string): void {
  const node = project.allNodes.find((n) => n.id === nodeId)
  if (!node) {
    room.updateSpeaker(index, { nodeId: '' })
    return
  }
  const spk = database.data.speakers[node.speakerId]
  const patch: Partial<SpeakerPlacement> = { nodeId }
  if (spk?.sensitivity !== undefined) patch.sensitivity = spk.sensitivity
  if (project.mode === 'high-v' && node.tapPower > 0) patch.powerW = node.tapPower
  room.updateSpeaker(index, patch)
}

function addObstacle(kind: 'stage' | 'cutout'): void {
  const g = room.geometry
  const ceilMid = ceilingAt(g, g.depth / 2)
  const floorMid = floorAt(g, g.depth / 2)
  const o: Omit<Obstacle, 'id'> = {
    kind,
    x: 1,
    y: 1,
    z: floorMid,
    width: 2,
    depth: 2,
    height: kind === 'stage' ? 0.4 : Math.max(0.5, ceilMid - floorMid),
    label: kind === 'stage' ? 'Stage' : 'Cutout',
  }
  room.addObstacle(o)
  activeTab.value = 'obstacles'
}

function addListenerHere(): void {
  const g = room.geometry
  const { cx, cy } = planCentre(g)
  const l: Omit<Listener, 'id'> = {
    x: cx,
    y: cy,
    autoHeight: true,
    z: floorAt(g, cy) + room.listenerHeight,
    label: `Seat ${room.listeners.length + 1}`,
  }
  room.addListener(l)
  activeTab.value = 'listeners'
}

function addSlope(): void {
  const g = room.geometry
  const { cx, cy } = planCentre(g)
  const s: Omit<Slope, 'id'> = {
    cx, cy,
    length: 4,
    widthLow: 1,
    widthHigh: 4,
    rotationDeg: 0,
    zLow: 0,
    zHigh: 1.2,
    raisesListener: true,
    label: 'Amphitheater',
  }
  room.addSlope(s)
  activeTab.value = 'slopes'
}

function rectPreset(): void {
  room.setGeometry({
    frontWidth: room.geometry.frontWidth,
    rearWidth: room.geometry.frontWidth,
    floorRearZ: room.geometry.floorFrontZ,
    ceilingRearZ: room.geometry.ceilingFrontZ,
  })
}

function fanPreset(): void {
  const w = room.geometry.frontWidth
  room.setGeometry({ rearWidth: w * 1.6 })
}

function rakedPreset(): void {
  room.setGeometry({ floorRearZ: room.geometry.floorFrontZ + 1.5 })
}

function pitchedPreset(): void {
  room.setGeometry({ ceilingRearZ: room.geometry.ceilingFrontZ + 2 })
}

onMounted(() => {
  const canvas = canvasEl.value!
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setClearColor(0x18181b)
  renderer.setSize(canvas.clientWidth, canvas.clientHeight)
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 400)
  roomGroup = new THREE.Group()
  speakerGroup = new THREE.Group()
  obstacleGroup = new THREE.Group()
  slopeGroup = new THREE.Group()
  listenerGroup = new THREE.Group()
  coverageGroup = new THREE.Group()
  heatmapGroup = new THREE.Group()
  scene.add(roomGroup)
  scene.add(speakerGroup)
  scene.add(obstacleGroup)
  scene.add(slopeGroup)
  scene.add(heatmapGroup)
  scene.add(coverageGroup)
  scene.add(listenerGroup)
  addGeometry()
  addSpeakers()
  addObstacles()
  addSlopes()
  addListeners()
  addCoverage()
  updateCamera()
  animate()
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)

  drawHeatmap()
  rebuildHeatmapTexture()
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  renderer?.dispose()
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('mousemove', onMouseMove)
})

watch(
  () => [
    room.geometry.depth, room.geometry.frontWidth, room.geometry.rearWidth,
    room.geometry.floorFrontZ, room.geometry.floorRearZ,
    room.geometry.ceilingFrontZ, room.geometry.ceilingRearZ,
  ],
  () => { addGeometry(); updateCamera(); rebuildHeatmapTexture() },
)
watch(() => room.speakers, () => { addSpeakers(); addCoverage() }, { deep: true })
watch(() => room.obstacles, addObstacles, { deep: true })
watch(() => room.slopes, addSlopes, { deep: true })
watch(() => room.listenerReadings, addListeners, { deep: true })
watch(() => room.show3dCoverage, addCoverage)
watch(() => room.show3dHeatmap, rebuildHeatmapTexture)
watch(() => room.listenerHeight, () => { addCoverage(); rebuildHeatmapTexture() })
watch(
  () => [room.heatmap, room.heatResolution],
  () => { drawHeatmap(); rebuildHeatmapTexture() },
  { deep: true },
)

const stats = computed(() => room.splStats)
const stiLabel = computed(() => `${room.sti.toFixed(2)} · ${stiRating(room.sti)}`)

const shapeLabel = computed(() => {
  const g = room.geometry
  const rect = Math.abs(g.frontWidth - g.rearWidth) < 1e-3
  const floorFlat = Math.abs(g.floorFrontZ - g.floorRearZ) < 1e-3
  const ceilFlat = Math.abs(g.ceilingFrontZ - g.ceilingRearZ) < 1e-3
  const parts: string[] = []
  parts.push(rect ? 'rectangular' : g.rearWidth > g.frontWidth ? 'fan' : 'narrowing')
  if (!floorFlat) parts.push(g.floorRearZ > g.floorFrontZ ? 'raked floor' : 'reverse rake')
  if (!ceilFlat) parts.push(g.ceilingRearZ > g.ceilingFrontZ ? 'rising ceiling' : 'dropping ceiling')
  return parts.join(' · ')
})
</script>

<template>
  <div class="room-view">
    <aside class="sidebar card">
      <nav class="tab-bar" role="tablist">
        <button
          v-for="t in TABS" :key="t.id"
          class="tab" :class="{ active: activeTab === t.id }"
          role="tab" :aria-selected="activeTab === t.id"
          @click="activeTab = t.id"
        >
          {{ t.label }}<span v-if="t.count" class="count">{{ t.count() }}</span>
        </button>
      </nav>

      <div class="tab-panel" v-show="activeTab === 'room'">
        <section class="accord">
          <header class="accord-head">
            <h4>Geometry</h4>
            <span class="muted mono xs">{{ shapeLabel }}</span>
          </header>
          <div class="grid2 tight">
            <label>Depth (m)
              <input type="number" min="1" step="0.1" :value="room.geometry.depth"
                     @input="room.setGeometry({ depth: +($event.target as HTMLInputElement).value })" />
            </label>
            <label>Absorption ᾱ
              <input type="number" min="0.01" max="0.99" step="0.01" :value="room.geometry.absorption"
                     @input="room.setGeometry({ absorption: +($event.target as HTMLInputElement).value })" />
            </label>
          </div>

          <h5 class="group-title">Plan width</h5>
          <div class="grid2 tight">
            <label title="Plan-view width at the front wall (y = 0)">Front (m)
              <input type="number" min="0.5" step="0.1" :value="room.geometry.frontWidth"
                     @input="room.setGeometry({ frontWidth: +($event.target as HTMLInputElement).value })" />
            </label>
            <label title="Plan-view width at the rear wall (y = depth)">Rear (m)
              <input type="number" min="0.5" step="0.1" :value="room.geometry.rearWidth"
                     @input="room.setGeometry({ rearWidth: +($event.target as HTMLInputElement).value })" />
            </label>
          </div>

          <h5 class="group-title">Floor height</h5>
          <div class="grid2 tight">
            <label title="Floor height at the front wall">Front (m)
              <input type="number" step="0.1" :value="room.geometry.floorFrontZ"
                     @input="room.setGeometry({ floorFrontZ: +($event.target as HTMLInputElement).value })" />
            </label>
            <label title="Floor height at the rear wall — raise to create amphitheater rake">Rear (m)
              <input type="number" step="0.1" :value="room.geometry.floorRearZ"
                     @input="room.setGeometry({ floorRearZ: +($event.target as HTMLInputElement).value })" />
            </label>
          </div>

          <h5 class="group-title">Ceiling height</h5>
          <div class="grid2 tight">
            <label title="Ceiling height at the front wall">Front (m)
              <input type="number" step="0.1" :value="room.geometry.ceilingFrontZ"
                     @input="room.setGeometry({ ceilingFrontZ: +($event.target as HTMLInputElement).value })" />
            </label>
            <label title="Ceiling height at the rear wall — different from front gives a pitched ceiling">Rear (m)
              <input type="number" step="0.1" :value="room.geometry.ceilingRearZ"
                     @input="room.setGeometry({ ceilingRearZ: +($event.target as HTMLInputElement).value })" />
            </label>
          </div>

          <div class="preset-row">
            <button class="ghost xs" @click="rectPreset" title="Flatten to a rectangular room">▭ rect</button>
            <button class="ghost xs" @click="fanPreset" title="Widen the rear wall (fan)">◁ fan</button>
            <button class="ghost xs" @click="rakedPreset" title="Raise the rear floor 1.5 m">↗ rake</button>
            <button class="ghost xs" @click="pitchedPreset" title="Raise the rear ceiling 2 m">⋀ pitch</button>
          </div>
        </section>

        <section class="accord">
          <header class="accord-head"><h4>Listener plane</h4></header>
          <div class="grid2 tight">
            <label>Height (m)
              <input type="number" min="0.5" step="0.1" v-model.number="room.listenerHeight" />
            </label>
            <label>Noise floor (dB A)
              <input type="number" min="25" max="80" v-model.number="room.noiseFloor" />
            </label>
            <label>Heatmap res (cells/m)
              <input type="number" min="1" max="5" step="1" v-model.number="room.heatResolution" />
            </label>
          </div>
        </section>

        <section class="accord">
          <header class="accord-head"><h4>Metrics</h4></header>
          <div class="metrics">
            <div><label>RT60</label><span>{{ room.rt.toFixed(2) }} s</span></div>
            <div><label>Critical distance</label><span>{{ room.critDist.toFixed(1) }} m</span></div>
            <div><label>SPL min / max / mean</label>
              <span>{{ stats.min.toFixed(0) }} / {{ stats.max.toFixed(0) }} / {{ stats.mean.toFixed(0) }} dB</span>
            </div>
            <div><label>Uniformity</label><span>{{ stats.uniformity.toFixed(1) }} dB</span></div>
            <div><label>STI</label><span>{{ stiLabel }}</span></div>
          </div>
        </section>
      </div>

      <div class="tab-panel" v-show="activeTab === 'speakers'">
        <div class="toolbar">
          <button v-for="m in MOUNT_OPTIONS" :key="m.v" class="ghost xs" @click="addPlacement(m.v)">
            + {{ m.label }}
          </button>
        </div>
        <p v-if="!room.speakers.length" class="empty">No placements yet — add one above.</p>
        <div class="item-list">
          <div v-for="(s, i) in room.speakers" :key="i" class="item">
            <div class="row">
              <span class="mono tag">#{{ i + 1 }}</span>
              <select :value="s.mount" @change="room.updateSpeaker(i, { mount: ($event.target as HTMLSelectElement).value as SpeakerMount })">
                <option v-for="m in MOUNT_OPTIONS" :key="m.v" :value="m.v">{{ m.label }}</option>
              </select>
              <button class="ghost icon" @click="room.removeSpeaker(i)" title="Remove">✕</button>
            </div>
            <div class="row">
              <label class="inline">Chain node
                <select :value="s.nodeId" @change="linkNode(i, ($event.target as HTMLSelectElement).value)">
                  <option value="">— unlinked —</option>
                  <option v-for="n in nodeOptions" :key="n.id" :value="n.id">{{ n.label }}</option>
                </select>
              </label>
            </div>
            <div class="row grid4">
              <label class="inline">x<input type="number" step="0.1" :value="s.x" @input="room.updateSpeaker(i, { x: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">y<input type="number" step="0.1" :value="s.y" @input="room.updateSpeaker(i, { y: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">z<input type="number" step="0.1" :value="s.z" @input="room.updateSpeaker(i, { z: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">W<input type="number" :value="s.powerW" @input="room.updateSpeaker(i, { powerW: +($event.target as HTMLInputElement).value })" /></label>
            </div>
            <div class="row grid4">
              <label class="inline">yaw°<input type="number" step="5" :value="s.yawDeg" @input="room.updateSpeaker(i, { yawDeg: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">pitch°<input type="number" step="5" min="-90" max="90" :value="s.pitchDeg" @input="room.updateSpeaker(i, { pitchDeg: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">half°<input type="number" step="5" :value="s.halfAngle" @input="room.updateSpeaker(i, { halfAngle: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">dB<input type="number" step="0.5" :value="s.sensitivity" @input="room.updateSpeaker(i, { sensitivity: +($event.target as HTMLInputElement).value })" /></label>
            </div>
          </div>
        </div>
      </div>

      <div class="tab-panel" v-show="activeTab === 'obstacles'">
        <div class="toolbar">
          <button class="ghost xs" @click="addObstacle('stage')">+ Stage</button>
          <button class="ghost xs" @click="addObstacle('cutout')">+ Cutout</button>
        </div>
        <p v-if="!room.obstacles.length" class="empty">Use stages for raised platforms, cutouts to carve an L or T plan.</p>
        <div class="item-list">
          <div v-for="(o, i) in room.obstacles" :key="o.id" class="item">
            <div class="row">
              <span class="mono tag" :class="o.kind">{{ o.kind }}</span>
              <input type="text" class="flex" :value="o.label ?? ''" placeholder="label" @input="room.updateObstacle(i, { label: ($event.target as HTMLInputElement).value })" />
              <button class="ghost icon" @click="room.removeObstacle(i)" title="Remove">✕</button>
            </div>
            <div class="row grid3">
              <label class="inline">x<input type="number" step="0.1" :value="o.x" @input="room.updateObstacle(i, { x: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">y<input type="number" step="0.1" :value="o.y" @input="room.updateObstacle(i, { y: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">z<input type="number" step="0.1" :value="o.z" @input="room.updateObstacle(i, { z: +($event.target as HTMLInputElement).value })" /></label>
            </div>
            <div class="row grid3">
              <label class="inline">w<input type="number" step="0.1" min="0.1" :value="o.width" @input="room.updateObstacle(i, { width: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">d<input type="number" step="0.1" min="0.1" :value="o.depth" @input="room.updateObstacle(i, { depth: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">h<input type="number" step="0.1" min="0.1" :value="o.height" @input="room.updateObstacle(i, { height: +($event.target as HTMLInputElement).value })" /></label>
            </div>
          </div>
        </div>
      </div>

      <div class="tab-panel" v-show="activeTab === 'slopes'">
        <div class="toolbar">
          <button class="ghost xs" @click="addSlope">+ Slope</button>
        </div>
        <p v-if="!room.slopes.length" class="empty">Slopes model raked audience seating and sloped atrium floors.</p>
        <div class="item-list">
          <div v-for="(s, i) in room.slopes" :key="s.id" class="item">
            <div class="row">
              <span class="mono tag slope">slope</span>
              <input type="text" class="flex" :value="s.label ?? ''" placeholder="label" @input="room.updateSlope(i, { label: ($event.target as HTMLInputElement).value })" />
              <button class="ghost icon" @click="room.removeSlope(i)" title="Remove">✕</button>
            </div>
            <div class="row grid4">
              <label class="inline">cx<input type="number" step="0.1" :value="s.cx" @input="room.updateSlope(i, { cx: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">cy<input type="number" step="0.1" :value="s.cy" @input="room.updateSlope(i, { cy: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">len<input type="number" step="0.1" min="0.1" :value="s.length" @input="room.updateSlope(i, { length: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">rot°<input type="number" step="5" :value="s.rotationDeg" @input="room.updateSlope(i, { rotationDeg: +($event.target as HTMLInputElement).value })" /></label>
            </div>
            <div class="row grid4">
              <label class="inline" title="Width at the low (front) edge">frontW<input type="number" step="0.1" min="0" :value="s.widthLow" @input="room.updateSlope(i, { widthLow: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline" title="Width at the high (rear) edge">rearW<input type="number" step="0.1" min="0" :value="s.widthHigh" @input="room.updateSlope(i, { widthHigh: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">zLow<input type="number" step="0.1" :value="s.zLow" @input="room.updateSlope(i, { zLow: +($event.target as HTMLInputElement).value })" /></label>
              <label class="inline">zHigh<input type="number" step="0.1" :value="s.zHigh" @input="room.updateSlope(i, { zHigh: +($event.target as HTMLInputElement).value })" /></label>
            </div>
            <div class="row">
              <button class="ghost xs" @click="room.updateSlope(i, { widthHigh: s.widthLow })" title="Rear = front → rectangle">≡ rect</button>
              <button class="ghost xs" @click="room.updateSlope(i, { widthLow: 0 })" title="Collapse front to a tip → pizza slice">▷ pizza</button>
              <button class="ghost xs" @click="room.updateSlope(i, { widthLow: s.widthHigh * 0.5 })" title="Half front, full rear → trapezoid">▱ trap</button>
            </div>
            <div class="row">
              <label class="inline checkbox" title="Seats on this slope follow the surface + listener height">
                <input type="checkbox"
                  :checked="s.raisesListener"
                  @change="room.updateSlope(i, { raisesListener: ($event.target as HTMLInputElement).checked })" />
                raises listeners
              </label>
              <span class="muted mono xs flex">
                rise {{ ((s.zHigh - s.zLow) / Math.max(s.length, 0.001) * 100).toFixed(0) }}% ·
                {{ s.widthLow === 0 || s.widthHigh === 0 ? 'pizza' : s.widthLow === s.widthHigh ? 'rect' : 'trap' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="tab-panel" v-show="activeTab === 'listeners'">
        <div class="toolbar">
          <button class="ghost xs" @click="addListenerHere">+ Listener</button>
        </div>
        <p v-if="!room.listeners.length" class="empty">
          Drop probe points to read direct + reverberant SPL and STI at specific seats.
          Auto-height follows the floor, any slope marked <em>raises listeners</em>, and stages.
        </p>
        <div class="item-list">
          <div v-for="(l, i) in room.listeners" :key="l.id" class="item">
            <div class="row">
              <span class="mono tag listener">L{{ i + 1 }}</span>
              <input type="text" class="flex" :value="l.label ?? ''" placeholder="label"
                     @input="room.updateListener(i, { label: ($event.target as HTMLInputElement).value })" />
              <button class="ghost icon" @click="room.removeListener(i)" title="Remove">✕</button>
            </div>
            <div class="row grid3">
              <label class="inline">x
                <input type="number" step="0.1" :value="l.x"
                       @input="room.updateListener(i, { x: +($event.target as HTMLInputElement).value })" />
              </label>
              <label class="inline">y
                <input type="number" step="0.1" :value="l.y"
                       @input="room.updateListener(i, { y: +($event.target as HTMLInputElement).value })" />
              </label>
              <label class="inline">z
                <input type="number" step="0.1" :disabled="l.autoHeight" :value="l.z"
                       @input="room.updateListener(i, { z: +($event.target as HTMLInputElement).value })" />
              </label>
            </div>
            <div class="row">
              <label class="inline checkbox">
                <input type="checkbox" :checked="l.autoHeight"
                       @change="room.updateListener(i, { autoHeight: ($event.target as HTMLInputElement).checked })" />
                auto-height (floor + slope + listener height)
              </label>
            </div>
            <div class="row" v-if="room.listenerReadings[i]">
              <span class="muted mono xs">
                z = {{ room.listenerReadings[i]!.z.toFixed(2) }} m ·
                SPL = {{ room.listenerReadings[i]!.spl.toFixed(0) }} dB ·
                STI = {{ room.listenerReadings[i]!.sti.toFixed(2) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <section class="panel canvas-wrap">
      <header class="panel-head">
        <h2>3D room</h2>
        <div class="toggle-row">
          <button
            class="toggle"
            :class="{ active: room.show3dHeatmap }"
            @click="room.setToggle({ show3dHeatmap: !room.show3dHeatmap })"
            title="Show SPL heatmap overlay on the listener plane"
          >heatmap</button>
          <button
            class="toggle"
            :class="{ active: room.show3dCoverage }"
            @click="room.setToggle({ show3dCoverage: !room.show3dCoverage })"
            title="Show each speaker's coverage ring at the listener plane"
          >coverage</button>
        </div>
        <span class="muted xs">Drag to orbit, scroll to zoom</span>
      </header>
      <canvas ref="canvasEl" class="canvas-3d"></canvas>
    </section>

    <section class="panel heat-wrap">
      <header class="panel-head">
        <h2>SPL heatmap (listener plane)</h2>
        <span class="muted">Outside-footprint and cutout cells rendered dark</span>
      </header>
      <canvas ref="heatEl" class="canvas-heat"></canvas>
    </section>
  </div>
</template>

<style scoped>
.room-view {
  display: grid;
  grid-template-columns: 340px 1fr;
  grid-template-rows: 1fr auto;
  gap: 8px;
  padding: 8px;
  height: calc(100vh - 38px);
  background: var(--bg);
}

.sidebar {
  grid-row: 1 / span 2;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-1);
}

/* Sidebar tab bar — instrument-strip header */
.tab-bar {
  display: flex;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%);
  flex-shrink: 0;
  height: 32px;
}
.tab {
  flex: 1;
  padding: 0 6px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--fg-dim);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border-bottom: 2px solid transparent;
  transition: background 80ms linear, color 80ms linear, border-color 80ms linear;
  box-shadow: none;
  border-radius: 0;
}
.tab:hover { background: rgba(255,255,255,0.025); color: var(--fg); }
.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: linear-gradient(180deg, var(--accent-soft) 0%, transparent 100%);
}
.tab .count {
  font-size: 9px;
  padding: 0 5px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: 7px;
  font-family: var(--font-mono);
  color: var(--fg-dim);
}
.tab.active .count {
  background: var(--accent);
  color: #001014;
  border-color: var(--accent);
}

.tab-panel {
  flex: 1;
  overflow: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Accordion sections */
.accord {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
}
.accord-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-soft);
  margin-bottom: 2px;
}
.accord-head h4 {
  margin: 0;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  color: var(--accent);
}
.group-title {
  margin: 4px 0 0 0;
  font-size: 9px;
  color: var(--fg-subtle);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.10em;
}

.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.grid2.tight label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.grid2.tight input {
  width: 100%;
  padding: 2px 6px;
  height: 22px;
  font-size: 11px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.preset-row {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  margin-top: 4px;
  padding: 2px;
  background: var(--bg-1);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
}

/* Per-tab toolbars */
.toolbar {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 6px;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  margin-bottom: 4px;
}

.empty {
  color: var(--fg-subtle);
  font-size: 11px;
  font-style: italic;
  margin: 8px 0;
  padding: 12px;
  text-align: center;
  border: 1px dashed var(--border-soft);
  border-radius: var(--radius-sm);
}

button.xs {
  font-size: 9px;
  padding: 0 8px;
  height: 22px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}
button.icon { padding: 0 6px; height: 22px; }

/* Channel-strip cards */
.item-list { display: flex; flex-direction: column; gap: 4px; }
.item {
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-left: 2px solid var(--accent-line);
  padding: 6px 8px;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.item:hover { border-left-color: var(--accent); background: var(--bg-2); }
.item .row { display: flex; gap: 4px; align-items: center; }
.item .row.grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.item .row.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.item input, .item select {
  font-size: 11px;
  padding: 2px 4px;
  height: 22px;
  min-width: 0;
  width: 100%;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.item .tag {
  padding: 1px 6px;
  background: var(--bg-2);
  border: 1px solid var(--border-soft);
  border-radius: 2px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-dim);
}
.item .tag.stage    { background: rgba(245,165,36,0.12);  color: var(--warn);   border-color: rgba(245,165,36,0.30); }
.item .tag.cutout   { background: rgba(244,63,94,0.12);   color: var(--error);  border-color: rgba(244,63,94,0.30); }
.item .tag.slope    { background: rgba(167,139,250,0.12); color: var(--violet); border-color: rgba(167,139,250,0.30); }
.item .tag.listener { background: rgba(244,63,94,0.12);   color: #fb7185;       border-color: rgba(244,63,94,0.30); }

.item .flex { flex: 1; }
.item label.inline {
  flex-direction: row;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-subtle);
}
.item label.inline input { flex: 1; }
.item label.inline.checkbox { font-size: 10px; color: var(--fg-dim); }
.item label.inline.checkbox input { flex: 0; width: auto; height: auto; }

/* Toggle pills — heatmap / coverage */
.toggle-row { display: flex; gap: 4px; }
.toggle {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0 10px;
  height: 22px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--fg-dim);
  cursor: pointer;
}
.toggle:hover { color: var(--fg); border-color: var(--border-strong); }
.toggle.active {
  color: var(--accent);
  border-color: var(--accent-line);
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent-line);
}

/* Metrics grid — meter readout */
.metrics {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  background: var(--bg-1);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
}
.metrics div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 11px;
  padding: 2px 0;
  border-bottom: 1px dotted var(--border-soft);
}
.metrics div:last-child { border-bottom: 0; }
.metrics label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-dim);
}
.metrics span {
  color: var(--accent);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  font-weight: 600;
}

.xs { font-size: 9px; letter-spacing: 0.04em; }

/* 3D viewport — instrument frame */
.canvas-wrap {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-1);
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 10px;
  height: 32px;
  background: linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%);
  border-bottom: 1px solid var(--border);
}
.panel-head :deep(h2) {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  color: var(--fg);
}
.canvas-3d {
  flex: 1;
  width: 100%;
  min-height: 400px;
  cursor: grab;
  display: block;
  background: radial-gradient(ellipse at center, #0b1220 0%, #050810 100%);
}
.canvas-3d:active { cursor: grabbing; }

/* SPL heatmap pane */
.heat-wrap {
  overflow: hidden;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-1);
}
.canvas-heat {
  display: block;
  width: 100%;
  height: 180px;
  image-rendering: pixelated;
  background: var(--bg);
}
</style>

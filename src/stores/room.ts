/** Room store — 3D installation layout + SPL coverage heatmap. */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { RoomGeometry } from '@/core/room'
import {
  directSpl, reverberantSpl, totalSpl, rt60, criticalDistance, stiEstimate,
  pointInRoom, widthRange, floorAt,
} from '@/core/room'
import type { PointSource } from '@/core/room'
import { read, write } from '@/services/storage'

export type SpeakerMount = 'ceiling' | 'wall' | 'pendant' | 'stand'

export interface SpeakerPlacement {
  /** Project-tree node id this placement corresponds to. Empty = loose source. */
  nodeId: string
  /** Mounting style — drives default orientation and 3D glyph. */
  mount: SpeakerMount
  x: number
  y: number
  z: number
  /** Horizontal rotation in degrees. 0 = +x, 90 = +y. */
  yawDeg: number
  /** Downward tilt in degrees. 0 = horizontal, 90 = straight down. */
  pitchDeg: number
  /** Cached from the speaker's own sensitivity field at load time. */
  sensitivity: number
  /** Input power in watts (chosen by the user for the sim). */
  powerW: number
  /** Coverage half-angle in degrees. */
  halfAngle: number
}

export type ObstacleKind = 'stage' | 'cutout'

export interface Obstacle {
  id: string
  kind: ObstacleKind
  /** Footprint lower-corner in metres. */
  x: number
  y: number
  /** Base height above the floor (m). Stages usually = 0; suspended shapes can float. */
  z: number
  width: number
  depth: number
  height: number
  label?: string
}

/** A raked / sloped listener surface — amphitheater seating, sloped atrium floor, etc.
 *
 *  Footprint is a trapezoid with its local +x axis running from the low edge to
 *  the high edge. widthLow and widthHigh are the (full) perpendicular widths at
 *  each end, so widthLow = 0 gives a pizza-slice triangle and widthLow = widthHigh
 *  gives a rectangle. The whole thing rotates by rotationDeg (CCW, around +z)
 *  about the pivot (cx, cy). Listener-plane height interpolates zLow → zHigh
 *  linearly along local x.
 */
export interface Slope {
  id: string
  /** Pivot (world-space centre of the footprint) in metres. */
  cx: number
  cy: number
  /** Total length along the local slope axis (low → high). */
  length: number
  /** Full perpendicular width at the low edge. Set to 0 for a pizza-slice tip. */
  widthLow: number
  /** Full perpendicular width at the high edge. */
  widthHigh: number
  /** CCW rotation about the pivot, in degrees. 0 = local +x aligns with world +x. */
  rotationDeg: number
  /** Surface height above the floor at the low edge (m). */
  zLow: number
  /** Surface height above the floor at the high edge (m). */
  zHigh: number
  /** If true, listeners inside the footprint sit at the slope surface + listenerHeight.
   *  If false, the slope is purely decorative and does not raise listeners. */
  raisesListener: boolean
  label?: string
}

/** A probe point: reports direct + reverberant SPL at a specific spot. */
export interface Listener {
  id: string
  label?: string
  x: number
  y: number
  /** When true, z auto-follows the local floor/slope + listenerHeight. */
  autoHeight: boolean
  /** Explicit z in metres, used when autoHeight is false. */
  z: number
}

export interface HeatmapCell {
  x: number
  y: number
  spl: number
}

const ROOM_STORAGE = 'sdt_room_v4'

function defaultRoom(): RoomGeometry {
  return {
    depth: 8,
    frontWidth: 12,
    rearWidth: 12,
    floorFrontZ: 0,
    floorRearZ: 0,
    ceilingFrontZ: 3.2,
    ceilingRearZ: 3.2,
    absorption: 0.2,
  }
}

/** Accept either the new trapezoid-prism shape or the legacy {width, depth, height}. */
function migrateGeometry(raw: unknown): RoomGeometry {
  const base = defaultRoom()
  if (!raw || typeof raw !== 'object') return base
  const g = raw as Partial<RoomGeometry> & {
    width?: number; height?: number
  }
  if (g.frontWidth !== undefined && g.ceilingFrontZ !== undefined) {
    return {
      depth: g.depth ?? base.depth,
      frontWidth: g.frontWidth,
      rearWidth: g.rearWidth ?? g.frontWidth,
      floorFrontZ: g.floorFrontZ ?? 0,
      floorRearZ: g.floorRearZ ?? g.floorFrontZ ?? 0,
      ceilingFrontZ: g.ceilingFrontZ,
      ceilingRearZ: g.ceilingRearZ ?? g.ceilingFrontZ,
      absorption: g.absorption ?? base.absorption,
    }
  }
  const w = g.width ?? base.frontWidth
  const h = g.height ?? base.ceilingFrontZ
  return {
    depth: g.depth ?? base.depth,
    frontWidth: w,
    rearWidth: w,
    floorFrontZ: 0,
    floorRearZ: 0,
    ceilingFrontZ: h,
    ceilingRearZ: h,
    absorption: g.absorption ?? base.absorption,
  }
}

function aimFromAngles(yawDeg: number, pitchDeg: number): { x: number; y: number; z: number } {
  const y = (yawDeg * Math.PI) / 180
  const p = (pitchDeg * Math.PI) / 180
  return {
    x: Math.cos(p) * Math.cos(y),
    y: Math.cos(p) * Math.sin(y),
    z: -Math.sin(p),
  }
}

/** Best-effort migration from legacy placements that stored aim directly. */
function migratePlacement(raw: unknown): SpeakerPlacement {
  const p = (raw ?? {}) as Partial<SpeakerPlacement> & { aim?: { x: number; y: number; z: number } }
  let yawDeg = p.yawDeg
  let pitchDeg = p.pitchDeg
  if ((yawDeg === undefined || pitchDeg === undefined) && p.aim) {
    const { x = 0, y = 0, z = -1 } = p.aim
    const mag = Math.sqrt(x * x + y * y + z * z) || 1
    const pr = -z / mag
    pitchDeg = (Math.asin(Math.max(-1, Math.min(1, pr))) * 180) / Math.PI
    yawDeg = (Math.atan2(y, x) * 180) / Math.PI
  }
  return {
    nodeId: p.nodeId ?? '',
    mount: p.mount ?? 'ceiling',
    x: p.x ?? 0,
    y: p.y ?? 0,
    z: p.z ?? 2.5,
    yawDeg: yawDeg ?? 0,
    pitchDeg: pitchDeg ?? 90,
    sensitivity: p.sensitivity ?? 88,
    powerW: p.powerW ?? 20,
    halfAngle: p.halfAngle ?? 60,
  }
}

function pointInFootprint(
  x: number, y: number,
  o: { x: number; y: number; width: number; depth: number },
): boolean {
  return x >= o.x && x <= o.x + o.width && y >= o.y && y <= o.y + o.depth
}

/** Transform a world point into the slope's local frame and report hit + interpolated height. */
export function slopeSample(x: number, y: number, s: Slope): { inside: boolean; height: number } {
  const theta = (s.rotationDeg * Math.PI) / 180
  const c = Math.cos(theta)
  const sn = Math.sin(theta)
  const dx = x - s.cx
  const dy = y - s.cy
  const lx = dx * c + dy * sn
  const ly = -dx * sn + dy * c
  const half = s.length / 2
  if (lx < -half || lx > half) return { inside: false, height: 0 }
  const t = (lx + half) / Math.max(s.length, 1e-6)
  const halfW = (s.widthLow + t * (s.widthHigh - s.widthLow)) / 2
  if (Math.abs(ly) > halfW) return { inside: false, height: 0 }
  return { inside: true, height: s.zLow + t * (s.zHigh - s.zLow) }
}

/** Migrate older axis-aligned-rect slopes into the trapezoid shape. */
function migrateSlope(raw: unknown): Slope {
  const p = (raw ?? {}) as Partial<Slope> & {
    x?: number; y?: number; width?: number; depth?: number; axis?: 'x' | 'y'
  }
  if (p.cx !== undefined && p.length !== undefined) {
    return {
      id: p.id ?? `S-${Math.random().toString(36).slice(2, 8)}`,
      cx: p.cx,
      cy: p.cy ?? 0,
      length: p.length,
      widthLow: p.widthLow ?? 0,
      widthHigh: p.widthHigh ?? 0,
      rotationDeg: p.rotationDeg ?? 0,
      zLow: p.zLow ?? 0,
      zHigh: p.zHigh ?? 0,
      raisesListener: p.raisesListener ?? true,
      label: p.label,
    }
  }
  const x = p.x ?? 0
  const y = p.y ?? 0
  const w = p.width ?? 2
  const d = p.depth ?? 2
  const axis = p.axis ?? 'y'
  const length = axis === 'x' ? w : d
  const perp = axis === 'x' ? d : w
  return {
    id: p.id ?? `S-${Math.random().toString(36).slice(2, 8)}`,
    cx: x + w / 2,
    cy: y + d / 2,
    length,
    widthLow: perp,
    widthHigh: perp,
    rotationDeg: axis === 'x' ? 0 : 90,
    zLow: p.zLow ?? 0,
    zHigh: p.zHigh ?? 0,
    raisesListener: p.raisesListener ?? true,
    label: p.label,
  }
}

function migrateListener(raw: unknown): Listener {
  const p = (raw ?? {}) as Partial<Listener>
  return {
    id: p.id ?? `L-${Math.random().toString(36).slice(2, 8)}`,
    label: p.label,
    x: p.x ?? 0,
    y: p.y ?? 0,
    autoHeight: p.autoHeight ?? true,
    z: p.z ?? 1.2,
  }
}

export const useRoomStore = defineStore('room', () => {
  const geometry = ref<RoomGeometry>(defaultRoom())
  const speakers = ref<SpeakerPlacement[]>([])
  const obstacles = ref<Obstacle[]>([])
  const slopes = ref<Slope[]>([])
  const listeners = ref<Listener[]>([])
  /** Listener-plane height above floor (m). */
  const listenerHeight = ref(1.2)
  /** Grid resolution for the heatmap (cells per metre). */
  const heatResolution = ref(2)
  /** Background noise floor used for STI (dB A). */
  const noiseFloor = ref(45)
  /** Show heatmap texture on the listener plane in the 3D view. */
  const show3dHeatmap = ref(true)
  /** Show per-speaker coverage rings in the 3D view. */
  const show3dCoverage = ref(true)

  try {
    const raw = read(ROOM_STORAGE)
    if (raw) {
      const p = JSON.parse(raw)
      if (p.geometry) geometry.value = migrateGeometry(p.geometry)
      if (Array.isArray(p.speakers)) speakers.value = p.speakers.map(migratePlacement)
      if (Array.isArray(p.obstacles)) obstacles.value = p.obstacles
      if (Array.isArray(p.slopes)) slopes.value = p.slopes.map(migrateSlope)
      if (Array.isArray(p.listeners)) listeners.value = p.listeners.map(migrateListener)
      if (p.listenerHeight !== undefined) listenerHeight.value = p.listenerHeight
      if (p.heatResolution !== undefined) heatResolution.value = p.heatResolution
      if (p.noiseFloor !== undefined) noiseFloor.value = p.noiseFloor
      if (p.show3dHeatmap !== undefined) show3dHeatmap.value = !!p.show3dHeatmap
      if (p.show3dCoverage !== undefined) show3dCoverage.value = !!p.show3dCoverage
    }
  } catch {}

  function save(): void {
    try {
      write(ROOM_STORAGE, JSON.stringify({
        geometry: geometry.value,
        speakers: speakers.value,
        obstacles: obstacles.value,
        slopes: slopes.value,
        listeners: listeners.value,
        listenerHeight: listenerHeight.value,
        heatResolution: heatResolution.value,
        noiseFloor: noiseFloor.value,
        show3dHeatmap: show3dHeatmap.value,
        show3dCoverage: show3dCoverage.value,
      }))
    } catch {}
  }

  /** Auto-height at (x, y): floor + any enabled slope/stage above + listenerHeight. */
  function autoListenerZ(x: number, y: number): number {
    const g = geometry.value
    const baseZ = listenerHeight.value
    let z = floorAt(g, y) + baseZ
    for (const sl of slopes.value) {
      if (!sl.raisesListener) continue
      const hit = slopeSample(x, y, sl)
      if (hit.inside) z = Math.max(z, hit.height + baseZ)
    }
    for (const st of obstacles.value) {
      if (st.kind === 'stage' && pointInFootprint(x, y, st)) {
        z = Math.max(z, st.z + st.height + baseZ)
      }
    }
    return z
  }

  const sources = computed<PointSource[]>(() =>
    speakers.value.map((s) => ({
      x: s.x, y: s.y, z: s.z,
      aim: aimFromAngles(s.yawDeg, s.pitchDeg),
      halfAngle: s.halfAngle,
      sensitivity: s.sensitivity,
      power: s.powerW,
    })),
  )

  const rt = computed(() => rt60(geometry.value))
  const reverbLevel = computed(() => reverberantSpl(sources.value, geometry.value))
  const critDist = computed(() => criticalDistance(geometry.value))

  const heatmap = computed<HeatmapCell[]>(() => {
    const g = geometry.value
    const maxWidth = Math.max(g.frontWidth, g.rearWidth)
    const res = heatResolution.value
    const nx = Math.max(2, Math.round(maxWidth * res))
    const ny = Math.max(2, Math.round(g.depth * res))
    const dx = maxWidth / (nx - 1)
    const dy = g.depth / (ny - 1)
    const baseZ = listenerHeight.value
    const reverb = reverbLevel.value
    const stages = obstacles.value.filter((o) => o.kind === 'stage')
    const cutouts = obstacles.value.filter((o) => o.kind === 'cutout')
    const slopeList = slopes.value
    const cells: HeatmapCell[] = []
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x = i * dx
        const y = j * dy
        if (!pointInRoom(g, x, y)) {
          cells.push({ x, y, spl: NaN })
          continue
        }
        if (cutouts.some((o) => pointInFootprint(x, y, o))) {
          cells.push({ x, y, spl: NaN })
          continue
        }
        let z = floorAt(g, y) + baseZ
        for (const sl of slopeList) {
          if (!sl.raisesListener) continue
          const hit = slopeSample(x, y, sl)
          if (hit.inside) z = Math.max(z, hit.height + baseZ)
        }
        for (const st of stages) {
          if (pointInFootprint(x, y, st)) z = Math.max(z, st.z + st.height + baseZ)
        }
        const direct = sources.value.map((s) => directSpl(s, { x, y, z }))
        cells.push({ x, y, spl: totalSpl(direct, reverb) })
      }
    }
    return cells
  })

  const splStats = computed(() => {
    if (!heatmap.value.length) return { min: 0, max: 0, mean: 0, uniformity: 0 }
    let min = Infinity
    let max = -Infinity
    let sum = 0
    let finiteCount = 0
    for (const c of heatmap.value) {
      if (!isFinite(c.spl)) continue
      min = Math.min(min, c.spl)
      max = Math.max(max, c.spl)
      sum += c.spl
      finiteCount++
    }
    const mean = finiteCount > 0 ? sum / finiteCount : 0
    return { min, max, mean, uniformity: max - min }
  })

  const sti = computed(() => {
    const snr = splStats.value.mean - noiseFloor.value
    return stiEstimate(snr, rt.value)
  })

  /** Resolved (x, y, z) + SPL + STI for each listener. */
  const listenerReadings = computed(() =>
    listeners.value.map((l) => {
      const z = l.autoHeight ? autoListenerZ(l.x, l.y) : l.z
      const direct = sources.value.map((s) => directSpl(s, { x: l.x, y: l.y, z }))
      const spl = totalSpl(direct, reverbLevel.value)
      const snr = spl - noiseFloor.value
      return { id: l.id, x: l.x, y: l.y, z, spl, sti: stiEstimate(snr, rt.value) }
    }),
  )

  function addSpeaker(p: SpeakerPlacement): void {
    speakers.value.push(p)
    save()
  }

  function updateSpeaker(index: number, patch: Partial<SpeakerPlacement>): void {
    const curr = speakers.value[index]
    if (!curr) return
    speakers.value[index] = { ...curr, ...patch }
    save()
  }

  function removeSpeaker(index: number): void {
    speakers.value.splice(index, 1)
    save()
  }

  function addObstacle(o: Omit<Obstacle, 'id'>): void {
    const id = `O-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`
    obstacles.value.push({ id, ...o })
    save()
  }

  function updateObstacle(index: number, patch: Partial<Obstacle>): void {
    const curr = obstacles.value[index]
    if (!curr) return
    obstacles.value[index] = { ...curr, ...patch }
    save()
  }

  function removeObstacle(index: number): void {
    obstacles.value.splice(index, 1)
    save()
  }

  function addSlope(s: Omit<Slope, 'id'>): void {
    const id = `S-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`
    slopes.value.push({ id, ...s })
    save()
  }

  function updateSlope(index: number, patch: Partial<Slope>): void {
    const curr = slopes.value[index]
    if (!curr) return
    slopes.value[index] = { ...curr, ...patch }
    save()
  }

  function removeSlope(index: number): void {
    slopes.value.splice(index, 1)
    save()
  }

  function addListener(l: Omit<Listener, 'id'>): void {
    const id = `L-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`
    listeners.value.push({ id, ...l })
    save()
  }

  function updateListener(index: number, patch: Partial<Listener>): void {
    const curr = listeners.value[index]
    if (!curr) return
    listeners.value[index] = { ...curr, ...patch }
    save()
  }

  function removeListener(index: number): void {
    listeners.value.splice(index, 1)
    save()
  }

  function setGeometry(g: Partial<RoomGeometry>): void {
    geometry.value = { ...geometry.value, ...g }
    save()
  }

  function setToggle(patch: Partial<{ show3dHeatmap: boolean; show3dCoverage: boolean }>): void {
    if (patch.show3dHeatmap !== undefined) show3dHeatmap.value = patch.show3dHeatmap
    if (patch.show3dCoverage !== undefined) show3dCoverage.value = patch.show3dCoverage
    save()
  }

  return {
    geometry, speakers, obstacles, slopes, listeners,
    listenerHeight, heatResolution, noiseFloor,
    show3dHeatmap, show3dCoverage,
    sources, rt, reverbLevel, critDist, heatmap, splStats, sti, listenerReadings,
    addSpeaker, updateSpeaker, removeSpeaker,
    addObstacle, updateObstacle, removeObstacle,
    addSlope, updateSlope, removeSlope,
    addListener, updateListener, removeListener,
    autoListenerZ,
    setGeometry, setToggle, save,
  }
})

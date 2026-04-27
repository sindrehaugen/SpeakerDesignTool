/** Room acoustics model — Sabine/Eyring RT60, direct + reverberant field,
 *  and a simplified STI estimate.
 *
 *  The room shape is a trapezoid prism: plan view narrows/widens along the
 *  depth axis, and the floor and ceiling can each independently slope from
 *  front to rear. This covers:
 *    • rectangular rooms (frontWidth = rearWidth, floors flat, ceilings flat)
 *    • trapezoid / fan-shaped halls (front ≠ rear width)
 *    • amphitheaters (raked floor)
 *    • atria and pitched-roof buildings (sloped ceiling)
 *
 *  This is a design-stage tool, not a boundary-element solver. It assumes a
 *  single equivalent absorption coefficient ᾱ per surface type and a diffuse
 *  reverberant field.
 */

export interface RoomGeometry {
  /** Depth axis, metres. Front wall at y=0, rear at y=depth. */
  depth: number
  /** Plan-view width at the front wall. */
  frontWidth: number
  /** Plan-view width at the rear wall. */
  rearWidth: number
  /** Floor height at the front wall (m). */
  floorFrontZ: number
  /** Floor height at the rear wall (m). */
  floorRearZ: number
  /** Ceiling height at the front wall (m). */
  ceilingFrontZ: number
  /** Ceiling height at the rear wall (m). */
  ceilingRearZ: number
  /** Average absorption coefficient of the surfaces (0–1). */
  absorption: number
}

export interface Listener {
  x: number
  y: number
  z: number
}

export interface PointSource {
  x: number
  y: number
  z: number
  sensitivity: number
  power: number
  halfAngle?: number
  aim?: { x: number; y: number; z: number }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function widthAt(room: RoomGeometry, y: number): number {
  const t = Math.max(0, Math.min(1, y / Math.max(room.depth, 1e-6)))
  return lerp(room.frontWidth, room.rearWidth, t)
}

export function floorAt(room: RoomGeometry, y: number): number {
  const t = Math.max(0, Math.min(1, y / Math.max(room.depth, 1e-6)))
  return lerp(room.floorFrontZ, room.floorRearZ, t)
}

export function ceilingAt(room: RoomGeometry, y: number): number {
  const t = Math.max(0, Math.min(1, y / Math.max(room.depth, 1e-6)))
  return lerp(room.ceilingFrontZ, room.ceilingRearZ, t)
}

/** Plan-view x range centered on the x-axis. Returns [xMin, xMax] at depth y. */
export function widthRange(room: RoomGeometry, y: number): [number, number] {
  const center = Math.max(room.frontWidth, room.rearWidth) / 2
  const w = widthAt(room, y)
  return [center - w / 2, center + w / 2]
}

export function pointInRoom(room: RoomGeometry, x: number, y: number): boolean {
  if (y < 0 || y > room.depth) return false
  const [lo, hi] = widthRange(room, y)
  return x >= lo && x <= hi
}

/** Plan-view floor area of the trapezoid (ignoring slope). */
export function floorPlanArea(room: RoomGeometry): number {
  return 0.5 * (room.frontWidth + room.rearWidth) * room.depth
}

/** True volume by integrating width(y) × (ceiling(y) − floor(y)) over depth. */
export function roomVolume(room: RoomGeometry): number {
  const a = room.frontWidth
  const b = room.rearWidth - room.frontWidth
  const h0 = room.ceilingFrontZ - room.floorFrontZ
  const h1 = room.ceilingRearZ - room.floorRearZ
  const c = h0
  const d = h1 - h0
  // ∫₀¹ (a + bt)(c + dt) dt = ac + (ad + bc)/2 + bd/3
  return room.depth * (a * c + (a * d + b * c) / 2 + (b * d) / 3)
}

/** Approximate total interior surface area (floor + ceiling + 4 walls). */
export function surfaceArea(room: RoomGeometry): number {
  const planTrapezoid = floorPlanArea(room)
  const floorTilt = Math.sqrt(1 + ((room.floorRearZ - room.floorFrontZ) / Math.max(room.depth, 1e-6)) ** 2)
  const ceilTilt = Math.sqrt(1 + ((room.ceilingRearZ - room.ceilingFrontZ) / Math.max(room.depth, 1e-6)) ** 2)
  const floor = planTrapezoid * floorTilt
  const ceiling = planTrapezoid * ceilTilt
  const front = room.frontWidth * Math.max(0, room.ceilingFrontZ - room.floorFrontZ)
  const rear = room.rearWidth * Math.max(0, room.ceilingRearZ - room.floorRearZ)
  // Each side wall is a quadrilateral — approximate area as two triangles.
  const side = sideWallArea(room)
  return floor + ceiling + front + rear + 2 * side
}

function sideWallArea(room: RoomGeometry): number {
  // Side wall at x = -frontWidth/2 at y=0, narrowing/widening with plan width.
  // We use a half-plan offset so the side walls are symmetric.
  const xFront = -room.frontWidth / 2
  const xRear = -room.rearWidth / 2
  const p1 = [xFront, 0, room.floorFrontZ]
  const p2 = [xRear, room.depth, room.floorRearZ]
  const p3 = [xRear, room.depth, room.ceilingRearZ]
  const p4 = [xFront, 0, room.ceilingFrontZ]
  return triArea(p1, p2, p3) + triArea(p1, p3, p4)
}

function triArea(a: number[], b: number[], c: number[]): number {
  const ab = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!]
  const ac = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!]
  const cross = [
    ab[1]! * ac[2]! - ab[2]! * ac[1]!,
    ab[2]! * ac[0]! - ab[0]! * ac[2]!,
    ab[0]! * ac[1]! - ab[1]! * ac[0]!,
  ]
  return 0.5 * Math.hypot(cross[0]!, cross[1]!, cross[2]!)
}

/** Total equivalent sabins (absorption area) in the room. */
export function totalAbsorption(room: RoomGeometry): number {
  return surfaceArea(room) * Math.max(1e-3, Math.min(1, room.absorption))
}

export function rt60Sabine(room: RoomGeometry): number {
  return (0.161 * roomVolume(room)) / totalAbsorption(room)
}

export function rt60Eyring(room: RoomGeometry): number {
  const a = Math.max(1e-3, Math.min(0.99, room.absorption))
  const S = surfaceArea(room)
  return (0.161 * roomVolume(room)) / (-S * Math.log(1 - a))
}

export function rt60(room: RoomGeometry): number {
  return room.absorption > 0.3 ? rt60Eyring(room) : rt60Sabine(room)
}

export function directSpl(source: PointSource, listener: Listener): number {
  const dx = listener.x - source.x
  const dy = listener.y - source.y
  const dz = listener.z - source.z
  const r = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (r < 0.5) return source.sensitivity + 10 * Math.log10(Math.max(source.power, 1e-6))
  const powerGain = 10 * Math.log10(Math.max(source.power, 1e-6))
  const distanceLoss = 20 * Math.log10(r)
  let axisLoss = 0
  if (source.halfAngle && source.aim) {
    const mag = Math.sqrt(source.aim.x ** 2 + source.aim.y ** 2 + source.aim.z ** 2)
    if (mag > 0) {
      const dot = (dx * source.aim.x + dy * source.aim.y + dz * source.aim.z) / (r * mag)
      const angleDeg = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI
      const ratio = angleDeg / source.halfAngle
      axisLoss = ratio <= 1
        ? -3 * ratio * ratio
        : -3 - 6 * Math.log2(ratio)
    }
  }
  return source.sensitivity + powerGain - distanceLoss + axisLoss
}

export function reverberantSpl(sources: PointSource[], room: RoomGeometry): number {
  const alpha = Math.max(1e-3, Math.min(0.99, room.absorption))
  const R = (surfaceArea(room) * alpha) / (1 - alpha)
  const fourOverR = 4 / R
  let totalPowerW = 0
  for (const s of sources) {
    const pAc = 10 ** ((s.sensitivity - 109) / 10) * Math.max(s.power, 0)
    totalPowerW += pAc
  }
  if (totalPowerW <= 0) return -Infinity
  const Lw = 10 * Math.log10(totalPowerW / 1e-12)
  return Lw + 10 * Math.log10(fourOverR)
}

export function totalSpl(direct: number[], reverberant: number): number {
  let sum = 0
  for (const d of direct) sum += 10 ** (d / 10)
  if (reverberant > -Infinity) sum += 10 ** (reverberant / 10)
  if (sum <= 0) return -Infinity
  return 10 * Math.log10(sum)
}

export function criticalDistance(room: RoomGeometry, directivityQ = 1): number {
  const v = roomVolume(room)
  const rt = rt60(room)
  if (rt <= 0) return Infinity
  return 0.141 * Math.sqrt((directivityQ * v) / rt)
}

export function stiEstimate(snrDb: number, rt60s: number, modHz = 2): number {
  const mRt = 1 / Math.sqrt(1 + (2 * Math.PI * modHz * rt60s / 13.8) ** 2)
  const mSnr = 1 / (1 + 10 ** (-snrDb / 10))
  const mti = mRt * mSnr
  const sti = (10 * Math.log10(mti / (1 - mti + 1e-9)) + 15) / 30
  return Math.max(0, Math.min(1, sti))
}

export function stiRating(sti: number): string {
  if (sti >= 0.75) return 'Excellent'
  if (sti >= 0.6) return 'Good'
  if (sti >= 0.45) return 'Fair'
  if (sti >= 0.3) return 'Poor'
  return 'Bad'
}

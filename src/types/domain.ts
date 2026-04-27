/** Domain model for the Speaker Design Tool. */

export type SystemMode = 'low-z' | 'high-v'
export type QualityMode = 'high-end' | 'average' | 'speech'
export type EquipmentType = 'speakers' | 'cables' | 'amplifiers'

export interface Speaker {
  id: string
  brand: string
  model: string
  impedance: number       // nominal Ω
  z_min?: number          // measured minimum impedance
  wattage_rms: number
  wattage_peak?: number
  max_spl?: number        // dB @ 1m
  sensitivity?: number    // dB @ 1W/1m
  taps?: number[]         // 100V/70V transformer taps (W)
  type?: 'Low-Z' | '100V' | 'Both'
  category?: string
}

export interface Cable {
  id: string
  brand: string
  model: string
  crossSection?: number   // mm²
  resistance: number      // Ω/km (loop DC)
  capacitance?: number    // pF/m
  inductance?: number     // µH/m
  /** Optional skin-effect coefficient (Ω/km per √kHz). 0 = ignore. */
  skinEffect?: number
}

export interface Amplifier {
  id: string
  brand: string
  model: string
  df?: number              // damping factor
  df_rated_at?: number     // Ω at which DF was measured
  min_load?: number        // minimum stable load (Ω)
  watt_8?: number
  watt_4?: number
  watt_2?: number
  watt_100v?: number
  min_load_bridge?: number
  watt_bridge_8?: number
  watt_bridge_4?: number
  max_voltage_peak?: number
  channels_lowz?: number
  channels_100v?: number
  /** -3 dB bandwidth if declared. Typical 20 Hz – 20 kHz. */
  bandwidth_hz?: [number, number]
}

export interface EquipmentDatabase {
  speakers: Record<string, Speaker>
  cables: Record<string, Cable>
  amplifiers: Record<string, Amplifier>
}

export interface AmpInstance {
  id: string               // e.g. "A-1"
  modelId: string
  channelsUsed: number[]
}

export interface NodeResults {
  status: 'OK' | 'Warning' | 'Error' | 'Pending'
  statusMessage?: string
  /** Load impedance magnitude at 1 kHz (Ω). */
  minLoad?: number
  nomLoad?: number
  /** Voltage drop % at 1 kHz. */
  dropPercent?: number
  dropVolts?: number
  /** Broadband HF loss measured at the quality-profile check frequency (dB). */
  hfLossDb?: number
  /** Electrical SPL loss due to cable (dB, at 1 kHz). */
  elecLossDb?: number
  /** Amp headroom used, % of rated power. */
  headroomPct?: number
  /** Total 100V tap power downstream (W). */
  totalPower?: number
  /** Voltage delivered to the speaker at 1 kHz (V). */
  voltageAtLoad?: number
  /** Current flowing through the branch at 1 kHz (A). */
  current?: number
}

export interface SignalNode {
  id: string               // e.g. "L-1" or "L-1.2"
  parentId: string | null
  userLabel: string
  /** Only meaningful on root nodes. */
  ampInstanceId: string
  ampChannel: number | null
  useBridgeMode: boolean
  speakerId: string
  parallelCount: number
  /** Only relevant in 100V mode. */
  tapPower: number
  cableId: string
  length: number
  useCable2: boolean
  cable2Id: string
  length2: number
  children: SignalNode[]
  results: NodeResults
}

export interface ProjectInfo {
  name: string
  date: string
}

export interface ReportInfo {
  company: string
  designer: string
  logoUrl: string
}

export interface Settings {
  temp_c: number
  freqGridPoints?: number
}

export interface QualityProfile {
  name: string
  maxDrop: number
  color: string
  minDamping: number
  hfCheckHz: number
}

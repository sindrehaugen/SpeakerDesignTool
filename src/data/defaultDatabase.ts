import type { EquipmentDatabase, QualityProfile, QualityMode } from '@/types/domain'

export const QUALITY_PROFILES: Record<QualityMode, QualityProfile> = {
  'high-end': { name: 'Hi-End (Reference)', maxDrop: 5, color: 'emerald', minDamping: 20, hfCheckHz: 10_000 },
  'average':  { name: 'Average (BGM)',      maxDrop: 10, color: 'amber',   minDamping: 10, hfCheckHz: 6_000 },
  'speech':   { name: 'Speech (Paging)',    maxDrop: 15, color: 'blue',    minDamping: 5,  hfCheckHz: 4_000 },
}

export const DEFAULT_DATABASE: EquipmentDatabase = {
  speakers: {
    'Default Speaker': {
      id: 'Default Speaker', brand: 'Generic', model: 'Standard 8Ω',
      impedance: 8, z_min: 6.4, wattage_rms: 100, wattage_peak: 200,
      max_spl: 100, sensitivity: 88, taps: [30, 15, 7.5], type: 'Both',
      category: 'small_fullrange',
    },
    'Default 100V Ceiling': {
      id: 'Default 100V Ceiling', brand: 'Generic', model: '6" Ceiling Speaker',
      impedance: 8, wattage_rms: 20, max_spl: 94, sensitivity: 89,
      taps: [10, 5, 2.5, 1.25], type: '100V',
    },
  },
  cables: {
    'Default Cable 1.5mm²': {
      id: 'Default Cable 1.5mm²', brand: 'Generic', model: 'OFC Standard 1.5mm²',
      crossSection: 1.5, resistance: 12.1, capacitance: 120, inductance: 0.70,
    },
    'Default Cable 2.5mm²': {
      id: 'Default Cable 2.5mm²', brand: 'Generic', model: 'OFC Pro 2.5mm²',
      crossSection: 2.5, resistance: 7.41, capacitance: 110, inductance: 0.65,
    },
    'Default Cable 4.0mm²': {
      id: 'Default Cable 4.0mm²', brand: 'Generic', model: 'OFC Heavy 4.0mm²',
      crossSection: 4.0, resistance: 4.61, capacitance: 100, inductance: 0.60,
    },
  },
  amplifiers: {
    'Default Amplifier': {
      id: 'Default Amplifier', brand: 'Generic', model: 'PowerAmp 500',
      df: 100, df_rated_at: 8, min_load: 2,
      watt_8: 250, watt_4: 500, watt_2: 0, watt_100v: 500,
      min_load_bridge: 4, watt_bridge_8: 1000, watt_bridge_4: 0,
      max_voltage_peak: 63.2, channels_lowz: 2, channels_100v: 2,
      bandwidth_hz: [20, 20_000],
    },
  },
}

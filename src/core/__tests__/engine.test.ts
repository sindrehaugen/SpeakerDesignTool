import { describe, it, expect } from 'vitest'
import { analyseChain } from '../engine'
import { makeGrid } from '../grid'
import type { EquipmentDatabase, SignalNode, QualityProfile } from '@/types/domain'

const db: EquipmentDatabase = {
  speakers: {
    '8R': { id: '8R', brand: 'T', model: '8Ω', impedance: 8, wattage_rms: 100, z_min: 6.4 },
  },
  cables: {
    '2.5': { id: '2.5', brand: 'T', model: '2.5mm²', resistance: 7.41, inductance: 0.65, capacitance: 110 },
  },
  amplifiers: {
    'amp': {
      id: 'amp', brand: 'T', model: 'X',
      watt_8: 250, watt_4: 500, min_load: 2, df: 100, df_rated_at: 8,
      channels_lowz: 2,
    },
  },
}

const profile: QualityProfile = {
  name: 'Hi-End', maxDrop: 5, color: 'emerald', minDamping: 20, hfCheckHz: 10_000,
}

function makeNode(overrides: Partial<SignalNode> = {}): SignalNode {
  return {
    id: 'L-1', parentId: null, userLabel: '',
    ampInstanceId: 'A-1', ampChannel: 1, useBridgeMode: false,
    speakerId: '8R', parallelCount: 1, tapPower: 0,
    cableId: '2.5', length: 20, useCable2: false, cable2Id: '', length2: 0,
    children: [], results: { status: 'Pending' },
    ...overrides,
  }
}

describe('analyseChain', () => {
  const grid = makeGrid(48)
  const ampRack = { 'A-1': { id: 'A-1', modelId: 'amp', channelsUsed: [1] } }

  it('returns OK for a short run of 8Ω speaker on 2.5mm² cable', () => {
    const root = makeNode({ length: 10 })
    const result = analyseChain({
      roots: [root], db, ampRack, mode: 'low-z', quality: profile, tempC: 20, grid,
    })
    const r = result.get('L-1')!
    expect(r.results.status).toBe('OK')
    expect(r.results.dropPercent!).toBeLessThan(profile.maxDrop)
  })

  it('flags Error when cable is grossly undersized', () => {
    const longCableDb: EquipmentDatabase = {
      ...db,
      cables: {
        'thin': { id: 'thin', brand: 'T', model: '0.2mm²', resistance: 100, inductance: 1, capacitance: 200 },
      },
    }
    const root = makeNode({ cableId: 'thin', length: 200 })
    const result = analyseChain({
      roots: [root], db: longCableDb, ampRack, mode: 'low-z', quality: profile, tempC: 20, grid,
    })
    const r = result.get('L-1')!
    expect(r.results.status).toBe('Error')
    expect(r.results.dropPercent!).toBeGreaterThan(profile.maxDrop * 1.5)
  })

  it('supports recursive children (daisy chain)', () => {
    const child = makeNode({ id: 'L-1.1', parentId: 'L-1', length: 5, ampInstanceId: '', ampChannel: null })
    const root = makeNode({ children: [child] })
    const result = analyseChain({
      roots: [root], db, ampRack, mode: 'low-z', quality: profile, tempC: 20, grid,
    })
    expect(result.has('L-1')).toBe(true)
    expect(result.has('L-1.1')).toBe(true)
    // Downstream node sees less voltage than root
    expect(result.get('L-1.1')!.results.voltageAtLoad!).toBeLessThan(
      result.get('L-1')!.results.voltageAtLoad!,
    )
  })

  it('computes spectral curves at every frequency', () => {
    const root = makeNode()
    const result = analyseChain({
      roots: [root], db, ampRack, mode: 'low-z', quality: profile, tempC: 20, grid,
    })
    const branch = result.get('L-1')!.branch
    expect(branch.frequencies.length).toBe(48)
    expect(branch.cableImpedance.length).toBe(48)
    expect(branch.loadImpedance.length).toBe(48)
    expect(branch.transmission.voltageAtLoad.length).toBe(48)
  })

  it('100V mode uses reflected impedance from taps', () => {
    const root = makeNode({ tapPower: 30 })
    const result = analyseChain({
      roots: [root], db, ampRack, mode: 'high-v', quality: profile, tempC: 20, grid,
    })
    const r = result.get('L-1')!
    // Reflected Z = 100²/30 = 333Ω → long cable has little effect
    expect(r.results.totalPower).toBe(30)
    expect(r.results.dropPercent!).toBeLessThan(2)
  })
})

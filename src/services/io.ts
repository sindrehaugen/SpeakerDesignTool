/** File IO helpers — CSV parsing, JSON project files, XLS export. */

import type {
  EquipmentDatabase, Speaker, Cable, Amplifier, ProjectInfo,
} from '@/types/domain'

export function downloadFile(name: string, content: string | Blob, mime = 'text/plain'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function generateItemId(brand: string, model: string): string {
  return `${(brand || 'Unknown').trim()}_${(model || 'Model').trim()}`.replace(/\s+/g, '_')
}

export function awgToMm2(awg: number): number {
  // Standard AWG → mm² conversion: A = 0.012668 · 92^((36-awg)/19.5)
  return 0.012668 * Math.pow(92, (36 - awg) / 19.5)
}

/** Parse a simple CSV: first row = header (case-insensitive), fields may be quoted.
 *  Quoted fields containing commas become string arrays when the header starts
 *  with "taps".
 */
export function parseCsv(text: string): Record<string, string | number | number[]>[] {
  const rows: Record<string, string | number | number[]>[] = []
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim())
  if (lines.length < 2) return rows

  const parseRow = (line: string): string[] => {
    const cells: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cells.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    cells.push(cur)
    return cells.map((c) => c.trim())
  }

  const header = parseRow(lines[0]!).map((h) => h.toLowerCase())
  const tapsIdx = header.indexOf('taps')
  const typeIdx = header.indexOf('type')
  const typeKeywords = ['low-z', 'lo-z', '100v', '70v', 'both', 'active', 'passive']

  for (let r = 1; r < lines.length; r++) {
    const cells = parseRow(lines[r]!)

    // Legacy v3: detect unquoted multi-value taps by finding the `type` keyword.
    let shift = 0
    if (tapsIdx > -1 && typeIdx > -1) {
      const found = cells.findIndex((v, i) => i >= typeIdx && typeKeywords.includes(v.toLowerCase()))
      if (found > typeIdx) shift = found - typeIdx
    }

    const obj: Record<string, string | number | number[]> = {}
    header.forEach((key, idx) => {
      const srcIdx = idx > tapsIdx && shift > 0 ? idx + shift : idx
      const raw = cells[srcIdx] ?? ''
      if (key === 'taps') {
        const tapCells = shift > 0
          ? cells.slice(tapsIdx, tapsIdx + shift + 1)
          : raw.split(/[,;]/)
        obj[key] = tapCells.map((v) => parseFloat(v)).filter((v) => !Number.isNaN(v))
      } else if (!Number.isNaN(parseFloat(raw)) && raw.match(/^-?\d+(\.\d+)?$/)) {
        obj[key] = parseFloat(raw)
      } else {
        obj[key] = raw
      }
    })
    rows.push(obj)
  }
  return rows
}

export function csvToSpeakers(text: string): Speaker[] {
  return parseCsv(text).map((r) => ({
    id: generateItemId(String(r['brand'] ?? ''), String(r['model'] ?? '')),
    brand: String(r['brand'] ?? 'Unknown'),
    model: String(r['model'] ?? 'Unknown'),
    impedance: Number(r['impedance'] ?? 8),
    z_min: r['z_min'] !== undefined ? Number(r['z_min']) : undefined,
    wattage_rms: Number(r['wattage_rms'] ?? r['watts'] ?? 50),
    wattage_peak: r['wattage_peak'] !== undefined ? Number(r['wattage_peak']) : undefined,
    max_spl: r['max_spl'] !== undefined ? Number(r['max_spl']) : undefined,
    sensitivity: r['sensitivity'] !== undefined ? Number(r['sensitivity']) : undefined,
    taps: Array.isArray(r['taps']) ? (r['taps'] as number[]) : [],
    type: (r['type'] as 'Low-Z' | '100V' | 'Both') ?? 'Both',
  }))
}

export function csvToCables(text: string): Cable[] {
  return parseCsv(text).map((r) => ({
    id: generateItemId(String(r['brand'] ?? ''), String(r['model'] ?? '')),
    brand: String(r['brand'] ?? 'Unknown'),
    model: String(r['model'] ?? 'Unknown'),
    crossSection: r['crosssection'] !== undefined ? Number(r['crosssection']) : undefined,
    resistance: Number(r['resistance'] ?? 10),
    capacitance: r['capacitance'] !== undefined ? Number(r['capacitance']) : undefined,
    inductance: r['inductance'] !== undefined ? Number(r['inductance']) : undefined,
  }))
}

export function csvToAmplifiers(text: string): Amplifier[] {
  return parseCsv(text).map((r) => ({
    id: generateItemId(String(r['brand'] ?? ''), String(r['model'] ?? '')),
    brand: String(r['brand'] ?? 'Unknown'),
    model: String(r['model'] ?? 'Unknown'),
    watt_8: r['watt_8'] !== undefined ? Number(r['watt_8']) : undefined,
    watt_4: r['watt_4'] !== undefined ? Number(r['watt_4']) : undefined,
    watt_100v: r['watt_100v'] !== undefined ? Number(r['watt_100v']) : undefined,
    channels_lowz: r['channels_lowz'] !== undefined ? Number(r['channels_lowz']) : 2,
    df: r['df'] !== undefined ? Number(r['df']) : undefined,
    min_load: r['min_load'] !== undefined ? Number(r['min_load']) : 2,
  }))
}

export function exportProjectJson(payload: Record<string, unknown>, fileName: string): void {
  downloadFile(`${fileName}.sdt.json`, JSON.stringify(payload, null, 2), 'application/json')
}

/** Export a minimal-but-valid Excel XML (SpreadsheetML 2003). Keeps the v3
 *  behaviour of producing a .xls file with multiple sheets and zero deps.
 */
export function exportToXls(project: ProjectInfo, sheets: Record<string, Array<Array<string | number | undefined>>>): void {
  const esc = (v: string | number | undefined): string =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const sheetXml = Object.entries(sheets)
    .map(([name, rows]) => {
      const body = rows
        .map((row) => {
          const cells = row
            .map((v) => {
              const t = typeof v === 'number' ? 'Number' : 'String'
              return `<Cell><Data ss:Type="${t}">${esc(v)}</Data></Cell>`
            })
            .join('')
          return `<Row>${cells}</Row>`
        })
        .join('')
      return `<Worksheet ss:Name="${esc(name).slice(0, 31)}"><Table>${body}</Table></Worksheet>`
    })
    .join('')

  const doc = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheetXml}
</Workbook>`
  downloadFile(`${project.name}_Report.xls`, doc, 'application/vnd.ms-excel')
}

export function exportDatabaseCsv(type: 'speakers' | 'cables' | 'amplifiers', db: EquipmentDatabase): void {
  const bucket = db[type]
  const items = Object.values(bucket)
  if (!items.length) return
  const keys = [...new Set(items.flatMap((i) => Object.keys(i as object)))]
  const rows = [keys.join(',')]
  for (const item of items) {
    const rec = item as Record<string, unknown>
    rows.push(keys.map((k) => {
      const v = rec[k]
      if (Array.isArray(v)) return `"${v.join(',')}"`
      return String(v ?? '')
    }).join(','))
  }
  downloadFile(`${type}.csv`, rows.join('\n'), 'text/csv')
}

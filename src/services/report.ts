/** PDF report generation via jsPDF + AutoTable. */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { EquipmentDatabase, ProjectInfo, ReportInfo, SignalNode, SystemMode, AmpInstance } from '@/types/domain'
import type { ChainAnalysis } from '@/core/engine'

interface ReportPayload {
  project: ProjectInfo
  report: ReportInfo
  mode: SystemMode
  db: EquipmentDatabase
  ampRack: Record<string, AmpInstance>
  roots: SignalNode[]
  analysis: ChainAnalysis
}

async function loadImage(src: string): Promise<{ data: string; w: number; h: number } | null> {
  if (!src) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      c.getContext('2d')!.drawImage(img, 0, 0)
      try { resolve({ data: c.toDataURL('image/png'), w: img.width, h: img.height }) }
      catch { resolve({ data: src, w: img.width, h: img.height }) }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function generatePdfReport(p: ReportPayload): Promise<void> {
  const doc = new jsPDF('l', 'mm', 'a4')

  doc.setFillColor(39, 39, 42)
  doc.rect(0, 0, 297, 35, 'F')
  doc.setFontSize(22); doc.setTextColor(255)
  doc.text('System Design Report', 15, 18)
  doc.setFontSize(10); doc.setTextColor(200)
  doc.text(`Project: ${p.project.name}`, 15, 26)
  doc.text(`Company: ${p.report.company || '-'}`, 15, 31)
  doc.text(`Designer: ${p.report.designer || '-'}`, 120, 26)
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 120, 31)

  if (p.report.logoUrl) {
    const logo = await loadImage(p.report.logoUrl)
    if (logo) {
      const fmt = logo.data.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'
      const maxW = 40, maxH = 25
      const aspect = logo.w / logo.h
      let w = maxW, h = w / aspect
      if (h > maxH) { h = maxH; w = h * aspect }
      doc.addImage(logo.data, fmt, 235 + (maxW - w) / 2, 8 + (maxH - h) / 2, w, h)
    }
  }

  const body: (string | number)[][] = []
  let spkCounter = 1
  const walk = (nodes: SignalNode[]): void => {
    for (const n of nodes) {
      const r = p.analysis.get(n.id)?.results
      const spk = p.db.speakers[n.speakerId]
      const cab = p.db.cables[n.cableId]
      const amp = n.ampInstanceId ? p.ampRack[n.ampInstanceId] : null
      const ampModel = amp ? p.db.amplifiers[amp.modelId] : null
      body.push([
        n.id,
        n.userLabel || '',
        amp ? `${amp.id} · ${ampModel?.brand ?? ''} ${ampModel?.model ?? ''} Ch${n.ampChannel ?? '-'}` : (n.parentId ? '->' : '-'),
        `S-${spkCounter++} · ${spk?.brand ?? ''} ${spk?.model ?? n.speakerId}`,
        `${cab?.brand ?? ''} ${cab?.model ?? n.cableId} (${n.length} m)`,
        p.mode === 'low-z' ? `${r?.minLoad?.toFixed(2) ?? '-'} Ω` : `${r?.totalPower ?? 0} W`,
        `${r?.dropPercent?.toFixed(2) ?? '-'} %`,
        `${r?.hfLossDb?.toFixed(2) ?? '-'} dB`,
        `${r?.elecLossDb?.toFixed(2) ?? '-'} dB`,
        r?.headroomPct ? `${r.headroomPct.toFixed(0)} %` : '-',
        r?.status ?? '-',
      ])
      walk(n.children)
    }
  }
  walk(p.roots)

  autoTable(doc, {
    startY: 40,
    head: [[
      'ID', 'Label', 'Amplifier', 'Speaker', 'Cable',
      p.mode === 'low-z' ? 'Load' : 'Power', 'V-Drop', 'HF Loss', 'Elec Loss', 'Headroom', 'Status',
    ]],
    body,
    styles: { fontSize: 7, halign: 'center' },
    columnStyles: { 1: { halign: 'left' }, 2: { halign: 'left' }, 3: { halign: 'left' }, 4: { halign: 'left' } },
    headStyles: { fillColor: [63, 63, 70] },
  })

  doc.save(`${p.project.name}_Report.pdf`)
}

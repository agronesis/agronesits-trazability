import * as XLSX from 'xlsx-js-style'
import type { TareoDiarioRow } from '@/services/tareo.service'

export function generateTareoDiarioExcel(fecha: string, rows: TareoDiarioRow[]): void {
  const aoa: Array<Array<string | number>> = [
    ['Tareo Diario'],
    [`Fecha: ${fecha}`],
    [],
    ['DNI', 'Colaborador', 'Rol', 'Kilos'],
    ...rows.map((r) => [
      r.dni ?? '-',
      `${r.apellido}, ${r.nombre}`,
      normalizarRol(r.rol),
      r.kilos,
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!cols'] = [
    { wch: 16 },
    { wch: 36 },
    { wch: 20 },
    { wch: 12 },
  ]

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:D1')
  for (let c = range.s.c; c <= range.e.c; c++) {
    const ref = XLSX.utils.encode_cell({ r: 3, c })
    if (!ws[ref]) continue
    ws[ref].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1F4E3D' } },
      alignment: { horizontal: 'center' },
      border: thinBorder(),
    }
  }

  for (let r = 4; r <= range.e.r; r++) {
    for (let c = 0; c <= 3; c++) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) continue
      ws[ref].s = {
        border: thinBorder(),
        alignment: { horizontal: c === 3 ? 'right' : 'left' },
        numFmt: c === 3 ? '0.00' : undefined,
      }
    }
  }

  ws['A1'].s = { font: { bold: true, sz: 14 } }
  ws['A2'].s = { font: { bold: true } }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Tareo diario')
  XLSX.writeFile(wb, `tareo-diario-${fecha}.xlsx`)
}

function thinBorder() {
  const b = { style: 'thin', color: { rgb: '000000' } }
  return { top: b, bottom: b, left: b, right: b }
}

function normalizarRol(rol: string): string {
  if (rol === 'recepcionista') return 'Recepcionista'
  if (rol === 'seleccionador') return 'Seleccionador'
  if (rol === 'empaquetador') return 'Empaquetador'
  return rol
}

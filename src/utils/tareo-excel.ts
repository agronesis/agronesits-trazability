import * as XLSX from 'xlsx-js-style'
import type { TareoDiarioRow } from '@/services/tareo.service'

export function generateTareoDiarioExcel(fecha: string, rows: TareoDiarioRow[]): void {
  const totalSugar = rows.reduce((acc, r) => acc + (r.kilos_sugar ?? 0), 0)
  const totalSnow = rows.reduce((acc, r) => acc + (r.kilos_snow ?? 0), 0)
  const totalKilos = rows.reduce((acc, r) => acc + r.kilos, 0)

  const aoa: Array<Array<string | number>> = [
    ['Tareo Diario'],
    [`Fecha: ${fecha}`],
    [],
    ['DNI', 'Colaborador', 'Rol', 'Kg Sugar Snap', 'Kg Snow Peas', 'Total Kilos'],
    ...rows.map((r) => [
      r.dni ?? '-',
      `${r.apellido}, ${r.nombre}`,
      normalizarRol(r.rol),
      Math.round((r.kilos_sugar ?? 0) * 100) / 100,
      Math.round((r.kilos_snow ?? 0) * 100) / 100,
      r.kilos,
    ]),
    [
      '',
      '',
      'TOTAL',
      Math.round(totalSugar * 100) / 100,
      Math.round(totalSnow * 100) / 100,
      Math.round(totalKilos * 100) / 100,
    ],
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!cols'] = [
    { wch: 16 },
    { wch: 36 },
    { wch: 20 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
  ]

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:F1')
  const lastRow = range.e.r
  const lastCol = 5

  for (let c = 0; c <= lastCol; c++) {
    const ref = XLSX.utils.encode_cell({ r: 3, c })
    if (!ws[ref]) continue
    ws[ref].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1F4E3D' } },
      alignment: { horizontal: 'center' },
      border: thinBorder(),
    }
  }

  for (let r = 4; r < lastRow; r++) {
    for (let c = 0; c <= lastCol; c++) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) continue
      ws[ref].s = {
        border: thinBorder(),
        alignment: { horizontal: c >= 3 ? 'right' : 'left' },
        numFmt: c >= 3 ? '0.00' : undefined,
      }
    }
  }

  for (let c = 0; c <= lastCol; c++) {
    const ref = XLSX.utils.encode_cell({ r: lastRow, c })
    if (!ws[ref]) continue
    ws[ref].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'E5E7EB' } },
      border: thinBorder(),
      alignment: { horizontal: c >= 3 ? 'right' : c === 2 ? 'right' : 'left' },
      numFmt: c >= 3 ? '0.00' : undefined,
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

import * as XLSX from 'xlsx-js-style'
import { formatFecha } from '@/utils/formatters'

export interface LotesSeleccionadosExportRow {
  codigo: string
  sublote: string
  agricultor: string
  fechaRecepcion: string | null
  variedad: string
  jabasIngresadas: number
  pesoBrutoRecepcion: number
  pesoNetoRecepcion: number
  fechaSeleccion: string | null
  jabasSeleccionadas: number
  pesoBrutoSeleccion: number
  pesoExportableSeleccion: number
  jabasDescarte: number
  pesoBrutoDescarte: number
  pesoNetoDescarte: number
  porcentajeExportable: number
  porcentajeDescarte: number
  porcentajeMerma: number
}

export function generateLotesSeleccionadosExcel(rows: LotesSeleccionadosExportRow[]): void {
  const headers = [
    'Codigo',
    'Sub lote',
    'Nombre del agricultor',
    'Fecha de recepcion',
    'Variedad',
    'Jabas ingresadas',
    'Peso bruto de recepcion (kg)',
    'Peso neto de recepcion (kg)',
    'Fecha de seleccion',
    'Jabas seleccionadas',
    'Peso bruto de seleccion (kg)',
    'Peso exportable de seleccion (kg)',
    'Jabas de descarte',
    'Peso bruto de descarte (kg)',
    'Peso neto de descarte (kg)',
    '% exportable',
    '% descarte',
    '% merma',
  ]

  const aoa: Array<Array<string | number>> = [
    ['Lotes seleccionados'],
    [`Generado: ${formatFecha(new Date().toISOString(), 'dd/MM/yyyy HH:mm')}`],
    [],
    headers,
    ...rows.map((row) => [
      row.codigo,
      row.sublote,
      row.agricultor,
      formatFecha(row.fechaRecepcion),
      row.variedad,
      row.jabasIngresadas,
      row.pesoBrutoRecepcion,
      row.pesoNetoRecepcion,
      formatFecha(row.fechaSeleccion),
      row.jabasSeleccionadas,
      row.pesoBrutoSeleccion,
      row.pesoExportableSeleccion,
      row.jabasDescarte,
      row.pesoBrutoDescarte,
      row.pesoNetoDescarte,
      row.porcentajeExportable,
      row.porcentajeDescarte,
      row.porcentajeMerma,
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!cols'] = [
    { wch: 16 },
    { wch: 14 },
    { wch: 32 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 22 },
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ]

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:R1')
  for (let c = range.s.c; c <= range.e.c; c++) {
    const ref = XLSX.utils.encode_cell({ r: 3, c })
    if (!ws[ref]) continue
    ws[ref].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1F4E3D' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: thinBorder(),
    }
  }

  for (let r = 4; r <= range.e.r; r++) {
    for (let c = 0; c <= 17; c++) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) continue

      const isNumber = c >= 5 && c <= 14
      const isPercent = c >= 15 && c <= 17

      ws[ref].s = {
        border: thinBorder(),
        alignment: { horizontal: isNumber || isPercent ? 'right' : 'left', vertical: 'center' },
        numFmt: isPercent ? '0.00%' : isNumber ? '0.00' : undefined,
      }
    }
  }

  if (ws['A1']) ws['A1'].s = { font: { bold: true, sz: 14 } }
  if (ws['A2']) ws['A2'].s = { font: { bold: true } }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Lotes seleccionados')

  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  XLSX.writeFile(wb, `lotes-seleccionados-${y}${m}${d}-${hh}${mm}.xlsx`)
}

function thinBorder() {
  const b = { style: 'thin', color: { rgb: '000000' } }
  return { top: b, bottom: b, left: b, right: b }
}

import * as XLSX from 'xlsx-js-style'
import { formatFecha } from '@/utils/formatters'

export interface LotesIngresadosExportRow {
  codigo: string
  agricultor: string
  dni: string
  lugarProduccion: string
  numeroCuenta: string
  fechaCosecha: string | null
  fechaRecepcion: string | null
  variedad: string
  jabasIngresadas: number
  kgBrutos: number
  kgNetos: number
}

export function generateLotesIngresadosExcel(rows: LotesIngresadosExportRow[]): void {
  const headers = [
    'CODIGO',
    'AGRICULTOR',
    'DNI',
    'LUGAR DE PRODUCCION',
    'NUMERO DE CUENTA',
    'FECHA DE COSECHA',
    'FECHA DE RECEPCION',
    'VARIEDAD',
    'JABAS INGRESADAS',
    'KG BRUTOS',
    'KG NETOS',
  ]

  const aoa: Array<Array<string | number>> = [
    ['Lotes ingresados'],
    [`Generado: ${formatFecha(new Date().toISOString(), 'dd/MM/yyyy HH:mm')}`],
    [],
    headers,
    ...rows.map((row) => [
      row.codigo,
      row.agricultor,
      row.dni,
      row.lugarProduccion,
      row.numeroCuenta,
      formatFecha(row.fechaCosecha),
      formatFecha(row.fechaRecepcion),
      row.variedad,
      row.jabasIngresadas,
      row.kgBrutos,
      row.kgNetos,
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!cols'] = [
    { wch: 20 },
    { wch: 32 },
    { wch: 12 },
    { wch: 28 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
  ]

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:K1')
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
    for (let c = 0; c <= 10; c++) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) continue
      const isNumber = c >= 8
      ws[ref].s = {
        border: thinBorder(),
        alignment: { horizontal: isNumber ? 'right' : 'left', vertical: 'center' },
        numFmt: isNumber ? '0.00' : undefined,
      }
    }
  }

  if (ws['A1']) ws['A1'].s = { font: { bold: true, sz: 14 } }
  if (ws['A2']) ws['A2'].s = { font: { bold: true } }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Lotes ingresados')

  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  XLSX.writeFile(wb, `lotes-ingresados-${y}${m}${d}-${hh}${mm}.xlsx`)
}

function thinBorder() {
  const b = { style: 'thin', color: { rgb: '000000' } }
  return { top: b, bottom: b, left: b, right: b }
}

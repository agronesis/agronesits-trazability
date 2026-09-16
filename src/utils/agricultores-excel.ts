import * as XLSX from 'xlsx-js-style'
import { formatFecha } from '@/utils/formatters'

// dni y numeroCuenta van como string a proposito: si entraran como number,
// Excel se comeria los ceros a la izquierda y pasaria las cuentas largas a
// notacion cientifica.
export interface AgricultoresExportRow {
  codigo: string
  apellidos: string
  nombres: string
  dni: string
  telefono: string
  numeroCuenta: string
  fechaAlta: string | null
  ubicacion: string
  estado: string
}

export function generateAgricultoresExcel(rows: AgricultoresExportRow[]): void {
  const headers = [
    'CODIGO',
    'APELLIDOS',
    'NOMBRES',
    'DNI',
    'TELEFONO',
    'NUMERO DE CUENTA',
    'FECHA DE ALTA',
    'UBICACION',
    'ESTADO',
  ]

  const aoa: Array<Array<string | number>> = [
    ['Padrón de agricultores'],
    [`Generado: ${formatFecha(new Date().toISOString(), 'dd/MM/yyyy HH:mm')} · ${rows.length} agricultores`],
    [],
    headers,
    ...rows.map((row) => [
      row.codigo,
      row.apellidos,
      row.nombres,
      row.dni,
      row.telefono,
      row.numeroCuenta,
      formatFecha(row.fechaAlta),
      row.ubicacion,
      row.estado,
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!cols'] = [
    { wch: 14 },
    { wch: 26 },
    { wch: 26 },
    { wch: 12 },
    { wch: 14 },
    { wch: 24 },
    { wch: 16 },
    { wch: 32 },
    { wch: 12 },
  ]

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:I1')
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
    for (let c = 0; c <= 8; c++) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) continue
      const isCentrado = c === 3 || c === 6 || c === 8
      ws[ref].s = {
        border: thinBorder(),
        alignment: { horizontal: isCentrado ? 'center' : 'left', vertical: 'center' },
      }
    }
  }

  if (ws['A1']) ws['A1'].s = { font: { bold: true, sz: 14 } }
  if (ws['A2']) ws['A2'].s = { font: { bold: true } }

  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: range.e.r, c: 8 } }) }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Agricultores')

  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  XLSX.writeFile(wb, `agricultores-${y}${m}${d}-${hh}${mm}.xlsx`)
}

function thinBorder() {
  const b = { style: 'thin', color: { rgb: '000000' } }
  return { top: b, bottom: b, left: b, right: b }
}

import * as XLSX from 'xlsx-js-style'
import { formatFecha } from '@/utils/formatters'
import type { TablaRespaldada } from '@/services/backup.service'

// Excel no admite nombres de hoja de mas de 31 caracteres.
const MAX_NOMBRE_HOJA = 31

const VERDE = '1F4E3D'

function thinBorder() {
  return {
    top: { style: 'thin', color: { rgb: 'D9D9D9' } },
    bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
    left: { style: 'thin', color: { rgb: 'D9D9D9' } },
    right: { style: 'thin', color: { rgb: 'D9D9D9' } },
  } as const
}

/**
 * Convierte un valor de la base en algo que Excel muestre fielmente.
 *
 * Todo sale como texto a proposito. Si los DNI o los numeros de cuenta
 * entraran como number, Excel se comeria los ceros a la izquierda y pasaria
 * las cuentas largas a notacion cientifica, que es justo lo que arruina un
 * respaldo. Los numeros de verdad (pesos, cantidades) se dejan como number
 * porque ahi si interesa poder sumarlos.
 */
function aCelda(valor: unknown): string | number {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'number') return valor
  if (typeof valor === 'boolean') return valor ? 'si' : 'no'
  // jsonb (datos_anteriores / datos_nuevos de audit_logs) y cualquier anidado.
  if (typeof valor === 'object') return JSON.stringify(valor)
  return String(valor)
}

/** Las columnas se toman de la union de todas las filas, no solo de la primera:
 *  una fila puede traer un campo en null y otra no. */
function columnasDe(filas: Array<Record<string, unknown>>): string[] {
  const vistas = new Set<string>()
  for (const fila of filas) {
    for (const col of Object.keys(fila)) vistas.add(col)
  }
  return [...vistas]
}

function hojaDeTabla({ tabla, filas }: TablaRespaldada): XLSX.WorkSheet {
  if (filas.length === 0) {
    return XLSX.utils.aoa_to_sheet([[`La tabla ${tabla} no tiene registros.`]])
  }

  const columnas = columnasDe(filas)
  const aoa: Array<Array<string | number>> = [
    columnas,
    ...filas.map((fila) => columnas.map((col) => aCelda(fila[col]))),
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = columnas.map((col) => ({ wch: Math.min(Math.max(col.length + 4, 12), 40) }))
  for (let c = 0; c < columnas.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c })
    if (!ws[ref]) continue
    ws[ref].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: VERDE } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: thinBorder(),
    }
  }

  return ws
}

function hojaResumen(tablas: TablaRespaldada[], generado: string): XLSX.WorkSheet {
  const total = tablas.reduce((acc, t) => acc + t.filas.length, 0)

  const aoa: Array<Array<string | number>> = [
    ['Respaldo completo — AGRONESIS'],
    [`Generado: ${generado}`],
    [`Total de registros: ${total}`],
    [],
    ['TABLA', 'REGISTROS'],
    ...tablas.map((t) => [t.tabla, t.filas.length]),
    [],
    ['Total', total],
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 34 }, { wch: 14 }]

  ws['A1'].s = { font: { bold: true, sz: 14, color: { rgb: VERDE } } }
  for (const ref of ['A5', 'B5']) {
    if (!ws[ref]) continue
    ws[ref].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: VERDE } },
      alignment: { horizontal: 'center' },
      border: thinBorder(),
    }
  }

  const filaTotal = 5 + tablas.length + 2
  for (const col of ['A', 'B']) {
    const ref = `${col}${filaTotal}`
    if (ws[ref]) ws[ref].s = { font: { bold: true } }
  }

  return ws
}

/**
 * Arma un libro con una hoja por tabla, mas una hoja de resumen al inicio,
 * y lo descarga.
 */
export function generateBackupExcel(tablas: TablaRespaldada[]): string {
  const ahora = new Date()
  const generado = formatFecha(ahora.toISOString(), 'dd/MM/yyyy HH:mm')

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, hojaResumen(tablas, generado), 'Resumen')

  for (const tabla of tablas) {
    XLSX.utils.book_append_sheet(wb, hojaDeTabla(tabla), tabla.tabla.slice(0, MAX_NOMBRE_HOJA))
  }

  const sello = formatFecha(ahora.toISOString(), 'yyyyMMdd-HHmm')
  const nombre = `respaldo-agronesis-${sello}.xlsx`
  XLSX.writeFile(wb, nombre)
  return nombre
}

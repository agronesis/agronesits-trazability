import * as XLSX from 'xlsx-js-style'
import type { Despacho } from '@/types/models'
import { DEFAULT_PESO_CAJA_DESPACHO_KG } from './business-rules'
import { formatFecha } from './formatters'

// ─────────────────────────────────────────────
// Tipos para el Anexo 4.1B
// ─────────────────────────────────────────────

export type Anexo41Row = {
  codigoLote: string
  numCajas: number
}

export type Anexo41Data = {
  despacho: Despacho
  rows: Anexo41Row[]
}

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

const NOMBRE_EMPACADORA = 'AGRONESIS DEL PERU S.A.C'
const MUESTRA_TOTAL = 10
const C = 9 // Columnas A–I (0–8)

// ─────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────

const DARK_GREEN = '1F4E3D'
const LIGHT_GREEN = 'C6EFCE'

/* eslint-disable @typescript-eslint/no-explicit-any */
type S = Record<string, any>

function thinBorder(): any {
  const b = { style: 'thin', color: { rgb: '000000' } }
  return { top: b, bottom: b, left: b, right: b }
}

const sTitle: S = {
  font: { bold: true, sz: 10, name: 'Calibri' },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: thinBorder(),
}

const sMetaLabel: S = {
  font: { bold: true, sz: 9, name: 'Calibri' },
  border: thinBorder(),
  alignment: { vertical: 'center' },
}

const sMetaVal: S = {
  font: { sz: 9, name: 'Calibri' },
  border: thinBorder(),
  alignment: { vertical: 'center' },
}

const sHeaderCell: S = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 8, name: 'Calibri' },
  fill: { fgColor: { rgb: DARK_GREEN } },
  border: thinBorder(),
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
}

const sDataCell: S = {
  font: { sz: 9, name: 'Calibri' },
  border: thinBorder(),
  alignment: { horizontal: 'center', vertical: 'center' },
}

const sDataGreen: S = {
  font: { sz: 9, name: 'Calibri' },
  fill: { fgColor: { rgb: LIGHT_GREEN } },
  border: thinBorder(),
  alignment: { horizontal: 'center', vertical: 'center' },
}

const sDataNum: S = {
  font: { sz: 9, name: 'Calibri' },
  border: thinBorder(),
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '#,##0',
}

const sDataNumGreen: S = {
  font: { sz: 9, name: 'Calibri' },
  fill: { fgColor: { rgb: LIGHT_GREEN } },
  border: thinBorder(),
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '#,##0',
}

const sDataDec: S = {
  font: { sz: 9, name: 'Calibri' },
  border: thinBorder(),
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '0.0',
}

const sTotalLabel: S = {
  font: { bold: true, sz: 9, name: 'Calibri' },
  border: thinBorder(),
  alignment: { vertical: 'center' },
}

const sTotalNum: S = {
  font: { bold: true, sz: 9, name: 'Calibri' },
  border: thinBorder(),
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '#,##0',
}

const sTotalDec: S = {
  font: { bold: true, sz: 9, name: 'Calibri' },
  border: thinBorder(),
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '0.00',
}

const sNote: S = {
  font: { sz: 8, name: 'Calibri' },
  alignment: { vertical: 'center' },
}

const sNoteLabel: S = {
  font: { bold: true, sz: 8, name: 'Calibri' },
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

type CellValue = string | number | null

function emptyRow(cols: number): CellValue[] {
  return new Array<CellValue>(cols).fill(null)
}

function setCell(ws: XLSX.WorkSheet, r: number, c: number, value: CellValue, style?: S) {
  const ref = XLSX.utils.encode_cell({ r, c })
  if (value === null || value === undefined || value === '') {
    ws[ref] = { t: 's', v: '' }
  } else if (typeof value === 'number') {
    ws[ref] = { t: 'n', v: value }
  } else {
    ws[ref] = { t: 's', v: value }
  }
  if (style) ws[ref].s = style
}

function styleRange(ws: XLSX.WorkSheet, r1: number, c1: number, r2: number, c2: number, style: S) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) ws[ref] = { t: 's', v: '' }
      ws[ref].s = style
    }
  }
}

// ─────────────────────────────────────────────
// Generador principal
// ─────────────────────────────────────────────

function calcJabas(cajas: number, pesoCaja: number): number {
  return (cajas * pesoCaja * 1.1) / 14
}

export function generateAnexo41Excel(data: Anexo41Data): void {
  const { despacho, rows } = data
  const pesoCaja = DEFAULT_PESO_CAJA_DESPACHO_KG
  const exportador = (despacho.exportador || NOMBRE_EMPACADORA).toUpperCase()

  // Totales
  const totalCajas = rows.reduce((sum, r) => sum + r.numCajas, 0)
  const totalJabas = calcJabas(totalCajas, pesoCaja)
  const totalPeso = +(totalCajas * pesoCaja).toFixed(2)
  const totalMuestrear = MUESTRA_TOTAL

  // ── Construir AOA ─────────────────────────

  const aoa: CellValue[][] = []

  // Row 0: EXP / FV
  { const r = emptyRow(C); r[0] = 'EXP:'; r[2] = 'FV'; aoa.push(r) }

  // Rows 1–4: Título (se mergea)
  {
    const r = emptyRow(C)
    r[0] = 'ANEXO 4.1B:  CONFORMACION DEL ENVIO Y TAMAÑO DE MUESTRA PARA INSPECCION FITOSANITARIA RAPIDA AL MOMENTO DEL EMBARQUE.                                                    (Aplicable a palta hass, mandarinas, tangelos, naranja, uva y mango)'
    aoa.push(r)
  }
  aoa.push(emptyRow(C))
  aoa.push(emptyRow(C))
  aoa.push(emptyRow(C))

  // Row 5: No | Fecha | Nombre Empacadora
  {
    const r = emptyRow(C)
    r[0] = 'No'
    r[1] = 'Fecha:'
    r[2] = formatFecha(despacho.fecha_despacho)
    r[3] = 'Nombre Empacadora:'
    r[4] = NOMBRE_EMPACADORA
    aoa.push(r)
  }

  // Row 6: Inspector | Exportador
  {
    const r = emptyRow(C)
    r[1] = 'Nombre de Inspector:'
    r[4] = 'Exportador:'
    r[5] = exportador
    aoa.push(r)
  }

  // Row 7: Encabezados de columna
  {
    const r = emptyRow(C)
    r[1] = 'CODIGO DE LUGAR DE PRODUCCION'
    r[2] = 'No DE GUIA DE REMISION'
    r[3] = 'NOMBRE DE PRODUCTOR/EXPORTADOR RESPONSABLE DE LA GUIA DE REMISION'
    r[4] = 'CODIGO DE LOTE ASIGNADO EN TRAZABILIDAD'
    r[5] = 'N° DE JABAS QUE SE USARON PARA ESTE ENVÍO'
    r[6] = 'CANTIDAD TOTAL CAJAS EXPORTABLE POR LP (1)'
    r[7] = 'PESO (KG)'
    r[8] = 'No DE CAJAS A MUESTREAR PARA INSPECCION'
    aoa.push(r)
  }

  // Rows de datos
  const DATA_START = aoa.length
  for (let i = 0; i < rows.length; i++) {
    const item = rows[i]
    const jabas = calcJabas(item.numCajas, pesoCaja)
    const peso = +(item.numCajas * pesoCaja).toFixed(2)
    const muestrear = totalCajas > 0 ? (item.numCajas / totalCajas) * MUESTRA_TOTAL : 0

    const r = emptyRow(C)
    r[0] = i + 1
    if (i === 0) r[3] = exportador
    r[4] = item.codigoLote
    r[5] = jabas
    r[6] = item.numCajas
    r[7] = peso
    r[8] = muestrear
    aoa.push(r)
  }
  const DATA_END = aoa.length - 1

  // Fila de totales
  const TOTALS_ROW = aoa.length
  {
    const r = emptyRow(C)
    r[1] = ' '
    r[5] = totalJabas
    r[6] = totalCajas
    r[7] = totalPeso
    r[8] = totalMuestrear
    aoa.push(r)
  }

  // Fila TOTAL CAJAS A MUESTREAR
  const MUESTREAR_ROW = aoa.length
  {
    const r = emptyRow(C)
    r[1] = 'TOTAL CAJAS A MUESTREAR:'
    r[8] = totalMuestrear
    aoa.push(r)
  }

  // Notas al pie
  { const r = emptyRow(C); r[0] = '(1) Colocar la cantidad de cajas que corresponde a cada lugar de producción que conforma el envío'; aoa.push(r) }
  { const r = emptyRow(C); r[0] = 'Nota:'; aoa.push(r) }
  { const r = emptyRow(C); r[0] = 'A.- Las celdas coloreadas en verde, es el detalle de la conformación del envío y debe ser llenado por el exportador y entregado al Inspector.'; aoa.push(r) }
  { const r = emptyRow(C); r[0] = 'B.- Con esta informacion el Inspector tomará la muestra para inspeccion al momento del embarque o embarcará fruta inspeccionada en linea.'; aoa.push(r) }
  { const r = emptyRow(C); r[0] = 'C.- LA última columna en blanco, debe ser llenado en las exportaciones de higo y granada a EEUU.'; aoa.push(r) }

  // ── Crear worksheet ───────────────────────

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // ── Aplicar estilos ───────────────────────

  // Row 0: EXP / FV
  setCell(ws, 0, 0, 'EXP:', { font: { bold: true, sz: 9, name: 'Calibri' } })
  setCell(ws, 0, 2, 'FV', { font: { bold: true, sz: 9, name: 'Calibri' } })

  // Rows 1–4: Título
  styleRange(ws, 1, 0, 4, 8, sTitle)

  // Row 5: Metadata fila 1
  setCell(ws, 5, 0, 'No', sHeaderCell)
  setCell(ws, 5, 1, 'Fecha:', sMetaLabel)
  setCell(ws, 5, 2, formatFecha(despacho.fecha_despacho), sMetaVal)
  setCell(ws, 5, 3, 'Nombre Empacadora:', sMetaLabel)
  setCell(ws, 5, 4, NOMBRE_EMPACADORA, sMetaVal)
  styleRange(ws, 5, 5, 5, 8, { border: thinBorder() })

  // Row 6: Metadata fila 2
  styleRange(ws, 6, 0, 6, 0, sHeaderCell)
  setCell(ws, 6, 1, 'Nombre de Inspector:', sMetaLabel)
  styleRange(ws, 6, 2, 6, 3, sMetaVal)
  setCell(ws, 6, 4, 'Exportador:', sMetaLabel)
  setCell(ws, 6, 5, exportador, sMetaVal)
  styleRange(ws, 6, 6, 6, 8, { border: thinBorder() })

  // Row 7: Encabezados de columnas
  styleRange(ws, 7, 0, 7, 0, sHeaderCell)
  for (let c = 1; c <= 8; c++) {
    const ref = XLSX.utils.encode_cell({ r: 7, c })
    if (!ws[ref]) ws[ref] = { t: 's', v: '' }
    ws[ref].s = sHeaderCell
  }

  // Filas de datos
  if (DATA_START <= DATA_END) {
    for (let r = DATA_START; r <= DATA_END; r++) {
      // Col A: número secuencial
      setCell(ws, r, 0, aoa[r][0], sDataCell)
      // Col B: código lugar producción (vacío, verde)
      setCell(ws, r, 1, '', sDataGreen)
      // Col C: guía remisión (vacío, verde)
      setCell(ws, r, 2, '', sDataGreen)
      // Col D: nombre productor (merge vertical)
      setCell(ws, r, 3, aoa[r][3], sDataCell)
      // Col E: código lote trazabilidad (verde)
      setCell(ws, r, 4, aoa[r][4], sDataGreen)
      // Col F: jabas (numérico, verde)
      setCell(ws, r, 5, aoa[r][5], sDataNumGreen)
      // Col G: cajas exportable (numérico, verde)
      setCell(ws, r, 6, aoa[r][6], sDataNumGreen)
      // Col H: peso
      setCell(ws, r, 7, aoa[r][7], sDataNum)
      // Col I: muestrear
      setCell(ws, r, 8, aoa[r][8], sDataDec)
    }
  }

  // Fila de totales
  styleRange(ws, TOTALS_ROW, 0, TOTALS_ROW, 4, sTotalLabel)
  setCell(ws, TOTALS_ROW, 5, totalJabas, sTotalNum)
  setCell(ws, TOTALS_ROW, 6, totalCajas, sTotalNum)
  setCell(ws, TOTALS_ROW, 7, totalPeso, sTotalNum)
  setCell(ws, TOTALS_ROW, 8, totalMuestrear, sTotalDec)

  // Fila TOTAL CAJAS A MUESTREAR
  styleRange(ws, MUESTREAR_ROW, 0, MUESTREAR_ROW, 7, sTotalLabel)
  setCell(ws, MUESTREAR_ROW, 1, 'TOTAL CAJAS A MUESTREAR:', sTotalLabel)
  setCell(ws, MUESTREAR_ROW, 8, totalMuestrear, sTotalDec)

  // Notas (merge cada fila A–I para que el texto quepa)
  const noteStart = MUESTREAR_ROW + 1
  const noteRows: number[] = []
  for (let r = noteStart; r < aoa.length; r++) {
    if (aoa[r][0] === 'Nota:') {
      setCell(ws, r, 0, aoa[r][0], sNoteLabel)
    } else if (aoa[r][0]) {
      setCell(ws, r, 0, aoa[r][0], sNote)
    }
    noteRows.push(r)
  }

  // ── Merges ────────────────────────────────

  const merges: XLSX.Range[] = [
    // Título (rows 1–4, cols A–I)
    { s: { r: 1, c: 0 }, e: { r: 4, c: 8 } },
    // "No" (rows 5–7, col A)
    { s: { r: 5, c: 0 }, e: { r: 7, c: 0 } },
    // Totales label (cols B–E)
    { s: { r: TOTALS_ROW, c: 1 }, e: { r: TOTALS_ROW, c: 4 } },
    // Total muestrear label (cols B–H)
    { s: { r: MUESTREAR_ROW, c: 1 }, e: { r: MUESTREAR_ROW, c: 7 } },
  ]

  // Columna D merge vertical (todas las filas de datos)
  if (rows.length > 1) {
    merges.push({ s: { r: DATA_START, c: 3 }, e: { r: DATA_END, c: 3 } })
  }

  // Notas: merge cada fila A–I
  for (const nr of noteRows) {
    merges.push({ s: { r: nr, c: 0 }, e: { r: nr, c: 8 } })
  }

  ws['!merges'] = merges

  // ── Anchos de columna ─────────────────────

  ws['!cols'] = [
    { wch: 5 },   // A: No
    { wch: 18 },  // B: CODIGO LUGAR PRODUCCION
    { wch: 16 },  // C: GUIA DE REMISION
    { wch: 28 },  // D: NOMBRE PRODUCTOR
    { wch: 18 },  // E: CODIGO LOTE TRAZABILIDAD
    { wch: 14 },  // F: JABAS
    { wch: 16 },  // G: CAJAS EXPORTABLE
    { wch: 12 },  // H: PESO (KG)
    { wch: 16 },  // I: MUESTREAR
  ]

  // ── Alturas de fila ───────────────────────

  ws['!rows'] = []
  ws['!rows'][7] = { hpx: 48 } // Encabezados altos para wrap

  // ── Escribir archivo ──────────────────────

  const wb = XLSX.utils.book_new()
  const sheetName = `${despacho.codigo} - 4.1`.substring(0, 31)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const fechaStr = despacho.fecha_despacho.replace(/-/g, '')
  const filename = `ANEXO_4.1B_${despacho.codigo}_${fechaStr}.xlsx`
  XLSX.writeFile(wb, filename)
}

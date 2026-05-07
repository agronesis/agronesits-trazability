import * as XLSX from 'xlsx-js-style'
import type { Despacho, VariedadProducto, CalidadProducto } from '@/types/models'
import { DEFAULT_PESO_CAJA_DESPACHO_KG } from './business-rules'
import { formatFecha } from './formatters'

// ─────────────────────────────────────────────
// Tipos para el Packing List
// ─────────────────────────────────────────────

export type PackingListRow = {
  numero_pallet: string
  codigo_trazabilidad: string
  ggn: string
  variedad: VariedadProducto
  calidad: CalidadProducto
  num_cajas: number
}

export type PackingListData = {
  despacho: Despacho
  rows: PackingListRow[]
  destinoGeografico: string
}

// ─────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────

const DARK_GREEN = '1F4E3D'
const GRAY_BG = 'D9D9D9'

/* eslint-disable @typescript-eslint/no-explicit-any */
type S = Record<string, any>

function thinBorder(): any {
  const b = { style: 'thin', color: { rgb: '000000' } }
  return { top: b, bottom: b, left: b, right: b }
}

const sLogo: S = {
  fill: { fgColor: { rgb: DARK_GREEN } },
  alignment: { horizontal: 'center', vertical: 'center' },
}

const sTitle: S = {
  font: { bold: true, sz: 12, name: 'Calibri' },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: thinBorder(),
}

const sTitleBig: S = {
  font: { bold: true, sz: 14, name: 'Calibri' },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: thinBorder(),
}

const sVerLabel: S = {
  font: { bold: true, sz: 9, name: 'Calibri' },
  fill: { fgColor: { rgb: GRAY_BG } },
  border: thinBorder(),
  alignment: { horizontal: 'right', vertical: 'center' },
}

const sVerVal: S = {
  font: { sz: 9, name: 'Calibri' },
  border: thinBorder(),
  alignment: { horizontal: 'center', vertical: 'center' },
}

const sApprLabel: S = {
  font: { bold: true, italic: true, sz: 9, name: 'Calibri', underline: true },
}

const sApprVal: S = {
  font: { sz: 9, name: 'Calibri' },
}

const sMetaLabel: S = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9, name: 'Calibri' },
  fill: { fgColor: { rgb: DARK_GREEN } },
  border: thinBorder(),
  alignment: { vertical: 'center' },
}

const sMetaVal: S = {
  font: { bold: true, sz: 10, name: 'Calibri' },
  border: thinBorder(),
  alignment: { vertical: 'center' },
}

const sTableHdr: S = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9, name: 'Calibri' },
  fill: { fgColor: { rgb: DARK_GREEN } },
  border: thinBorder(),
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
}

const sWeightLabel: S = {
  font: { bold: true, sz: 10, name: 'Calibri' },
  border: thinBorder(),
  alignment: { horizontal: 'center', vertical: 'center' },
}

const sDataCell: S = {
  font: { sz: 9, name: 'Calibri' },
  border: thinBorder(),
  alignment: { vertical: 'center' },
}

const sDataNum: S = {
  font: { sz: 9, name: 'Calibri' },
  border: thinBorder(),
  alignment: { horizontal: 'right', vertical: 'center' },
}

const sSumLabel: S = {
  font: { bold: true, sz: 10, name: 'Calibri' },
  border: thinBorder(),
  alignment: { vertical: 'center' },
}

const sSumVal: S = {
  font: { bold: true, sz: 10, name: 'Calibri' },
  border: thinBorder(),
  alignment: { horizontal: 'right', vertical: 'center' },
}

const sDistLabel: S = {
  font: { bold: true, sz: 9, name: 'Calibri' },
  fill: { fgColor: { rgb: GRAY_BG } },
  border: thinBorder(),
  alignment: { horizontal: 'center', vertical: 'center' },
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─────────────────────────────────────────────
// Constantes de mapeo
// ─────────────────────────────────────────────

const CALIDAD_LABEL: Record<string, string> = {
  cat1: 'CLASS I',
  cat2: 'CLASS II',
}

const VARIEDAD_LABEL: Record<string, string> = {
  snow_peas: 'Snow Peas',
  sugar: 'Sugar Snap',
}

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

export function generatePackingListExcel(data: PackingListData): void {
  const { despacho, rows, destinoGeografico } = data
  const pesoCaja = DEFAULT_PESO_CAJA_DESPACHO_KG
  const marca = (despacho.marca_caja || '').toUpperCase()
  const marcaCorta = marca.split(' ')[0] || marca
  const C = 14 // columns A-N (0-13)

  // Variedad label
  const hasSnow = rows.some(r => r.variedad === 'snow_peas')
  const hasSugar = rows.some(r => r.variedad === 'sugar')
  let variedadTexto = '-'
  if (hasSnow && hasSugar) variedadTexto = 'HOLANTAO / SUGAR SNAP - SNOW PEAS'
  else if (hasSnow) variedadTexto = 'HOLANTAO / SNOW PEAS'
  else if (hasSugar) variedadTexto = 'SUGAR SNAP'

  // ── Construir AOA ─────────────────────────

  const aoa: CellValue[][] = []

  // Rows 0-3: Document header
  { const r = emptyRow(C); r[2] = 'REGISTRO'; r[11] = 'CÓDIGO:'; r[13] = 'PD-PR-R-01'; aoa.push(r) }
  { const r = emptyRow(C); r[11] = 'VERSIÓN:'; r[13] = '01'; aoa.push(r) }
  { const r = emptyRow(C); r[2] = 'PACKING LIST'; r[11] = 'REVISIÓN:'; r[13] = '01'; aoa.push(r) }
  { const r = emptyRow(C); r[11] = 'FECHA:'; r[13] = formatFecha(despacho.fecha_despacho); aoa.push(r) }

  // Rows 4-5: Approval
  { const r = emptyRow(C); r[0] = 'Elaborado por:'; r[2] = 'Revisado por:'; r[11] = 'Aprobado por:'; aoa.push(r) }
  { const r = emptyRow(C); r[0] = 'Jefe de SIG'; r[2] = 'Equipo HACCP'; r[11] = 'Gerente General'; aoa.push(r) }

  // Rows 6-7: Empty
  aoa.push(emptyRow(C))
  aoa.push(emptyRow(C))

  // Rows 8-16: Metadata
  { const r = emptyRow(C); r[0] = 'PRODUCTO / VARIEDAD'; r[2] = variedadTexto; r[6] = 'N° DE EMBARQUE'; aoa.push(r) }
  { const r = emptyRow(C); r[0] = 'FECHA'; r[2] = formatFecha(despacho.fecha_despacho); r[6] = 'EXPORTADOR'; r[8] = despacho.exportador || ''; aoa.push(r) }
  { const r = emptyRow(C); r[0] = 'TERMOGRAFO 1'; r[6] = 'DESTINO'; r[8] = destinoGeografico; aoa.push(r) }
  { const r = emptyRow(C); r[0] = 'TERMOGRAFO 2'; r[6] = 'PLACA'; r[8] = despacho.placa_vehiculo || ''; aoa.push(r) }
  { const r = emptyRow(C); r[0] = 'COD. CONTENEDOR'; r[6] = 'PRECINTO DE LLEGADA'; aoa.push(r) }
  { const r = emptyRow(C); r[0] = 'N°BOOKING'; r[6] = 'PRECINTO DE ADUANA'; aoa.push(r) }
  { const r = emptyRow(C); r[6] = 'PRECINTO DE LINEA'; aoa.push(r) }
  { const r = emptyRow(C); r[6] = 'PRECINTO DE SENASA'; aoa.push(r) }
  { const r = emptyRow(C); r[6] = 'CLIENTE'; aoa.push(r) }

  // Rows 17-18: Empty
  aoa.push(emptyRow(C))
  aoa.push(emptyRow(C))

  // Row 19: Weight label
  { const r = emptyRow(C); r[8] = `${pesoCaja}KG`; aoa.push(r) }

  // Row 20: Table column headers
  {
    const r = emptyRow(C)
    r[0] = 'PALLET'; r[1] = 'TRAZABILIDAD'; r[2] = 'GGN'; r[3] = 'VARIEDAD'
    r[4] = 'MARCA DE CAJA'; r[5] = 'CAT'; r[6] = 'PRESENTACIÓN'; r[8] = 'S/C'; r[12] = 'TOTAL'
    aoa.push(r)
  }

  // Row 21: Separator
  aoa.push(emptyRow(C))

  // Rows 22+: Data
  const DATA_START = aoa.length
  let totalCajas = 0
  for (const item of rows) {
    const num = parseInt(item.numero_pallet, 10)
    const palletLabel = Number.isFinite(num) ? `P-${num}` : `P-${item.numero_pallet}`
    const presentacion = `CAJA CP BLANCA ${pesoCaja} KG - ${marcaCorta}`

    const r = emptyRow(C)
    r[0] = palletLabel
    r[1] = item.codigo_trazabilidad
    r[2] = item.ggn || ''
    r[3] = VARIEDAD_LABEL[item.variedad] || item.variedad
    r[4] = marca
    r[5] = CALIDAD_LABEL[item.calidad] || item.calidad
    r[6] = presentacion
    r[12] = item.num_cajas
    aoa.push(r)
    totalCajas += item.num_cajas
  }
  const DATA_END = aoa.length - 1

  // Summary rows
  const totalKilos = +(totalCajas * pesoCaja).toFixed(2)
  const uniquePallets = new Set(rows.map(r => r.numero_pallet)).size

  const SUM_START = aoa.length
  { const r = emptyRow(C); r[0] = `TOTAL DE CAJAS ${pesoCaja}KG`; r[8] = 0; r[12] = totalCajas; aoa.push(r) }
  { const r = emptyRow(C); r[0] = `TOTAL DE PALLETS ${pesoCaja}KG`; r[8] = 0; r[12] = uniquePallets; aoa.push(r) }
  { const r = emptyRow(C); r[0] = 'TOTAL DE CAJAS'; r[12] = totalCajas; aoa.push(r) }
  { const r = emptyRow(C); r[0] = 'TOTAL DE PALLETS'; r[12] = uniquePallets; aoa.push(r) }
  { const r = emptyRow(C); r[0] = 'TOTAL KILOS DESPACHADOS'; r[8] = `TOTAL KILOS ${pesoCaja}KG`; r[11] = totalKilos; r[12] = totalKilos; aoa.push(r) }
  const SUM_END = aoa.length - 1

  // Distribution section
  aoa.push(emptyRow(C))
  aoa.push(emptyRow(C))
  aoa.push(emptyRow(C))
  const DIST_START = aoa.length
  { const r = emptyRow(C); r[0] = 'FOTOS DEL PRODUCTO/DESPACHO'; r[9] = 'DISTRIBUCIÓN DE LA CARGA'; aoa.push(r) }
  { const r = emptyRow(C); r[9] = 'FONDO'; aoa.push(r) }
  { const r = emptyRow(C); r[9] = 'IZQUIERDA'; r[11] = 'DERECHA'; aoa.push(r) }
  { const r = emptyRow(C); r[9] = 'N° Pallet'; r[10] = 'Calibre'; r[11] = 'N° Pallet'; r[12] = 'Calibre'; aoa.push(r) }

  // ── Crear worksheet ───────────────────────

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // ── Aplicar estilos ───────────────────────

  // Logo area (rows 0-3, cols 0-1)
  styleRange(ws, 0, 0, 3, 1, sLogo)

  // Title area (rows 0-3, cols 2-10)
  styleRange(ws, 0, 2, 3, 10, sTitle)
  setCell(ws, 0, 2, 'REGISTRO', sTitle)
  setCell(ws, 2, 2, 'PACKING LIST', sTitleBig)

  // Version labels (rows 0-3, cols 11-12) and values (col 13)
  for (let r = 0; r <= 3; r++) {
    styleRange(ws, r, 11, r, 12, sVerLabel)
    setCell(ws, r, 13, aoa[r][13], sVerVal)
  }

  // Approval section (rows 4-5)
  for (const c of [0, 2, 11]) {
    setCell(ws, 4, c, aoa[4][c], sApprLabel)
    setCell(ws, 5, c, aoa[5][c], sApprVal)
  }

  // Metadata section (rows 8-16)
  const metaLeftRows = [8, 9, 10, 11, 12, 13]
  const metaRightRows = [8, 9, 10, 11, 12, 13, 14, 15, 16]

  for (const r of metaLeftRows) {
    styleRange(ws, r, 0, r, 1, sMetaLabel)
    styleRange(ws, r, 2, r, 5, sMetaVal)
  }
  for (const r of metaRightRows) {
    styleRange(ws, r, 6, r, 7, sMetaLabel)
    styleRange(ws, r, 8, r, 10, sMetaVal)
  }

  // Weight label (row 19)
  setCell(ws, 19, 8, `${pesoCaja}KG`, sWeightLabel)

  // Table headers (row 20, cols 0-12)
  styleRange(ws, 20, 0, 20, 12, sTableHdr)

  // Data rows
  if (DATA_START <= DATA_END) {
    for (let r = DATA_START; r <= DATA_END; r++) {
      for (let c = 0; c < C; c++) {
        const style = c === 12 ? sDataNum : sDataCell
        const ref = XLSX.utils.encode_cell({ r, c })
        if (!ws[ref]) ws[ref] = { t: 's', v: '' }
        ws[ref].s = style
      }
    }
  }

  // Summary rows
  for (let r = SUM_START; r <= SUM_END; r++) {
    styleRange(ws, r, 0, r, C - 1, sSumLabel)
    for (const c of [8, 11, 12]) {
      if (aoa[r][c] !== null && aoa[r][c] !== undefined) {
        setCell(ws, r, c, aoa[r][c], sSumVal)
      }
    }
  }

  // Distribution section
  setCell(ws, DIST_START, 0, 'FOTOS DEL PRODUCTO/DESPACHO', { font: { bold: true, sz: 9, name: 'Calibri' } })
  styleRange(ws, DIST_START, 9, DIST_START + 3, 12, sDistLabel)

  // ── Merges ────────────────────────────────

  ws['!merges'] = [
    // Logo area
    { s: { r: 0, c: 0 }, e: { r: 3, c: 1 } },
    // REGISTRO (rows 0-1, cols 2-10)
    { s: { r: 0, c: 2 }, e: { r: 1, c: 10 } },
    // PACKING LIST (rows 2-3, cols 2-10)
    { s: { r: 2, c: 2 }, e: { r: 3, c: 10 } },
    // Version labels (cols 11-12 per row)
    ...[0, 1, 2, 3].map(r => ({ s: { r, c: 11 }, e: { r, c: 12 } })),
    // Metadata left labels (cols 0-1)
    ...metaLeftRows.map(r => ({ s: { r, c: 0 }, e: { r, c: 1 } })),
    // Metadata left values (cols 2-5)
    ...metaLeftRows.map(r => ({ s: { r, c: 2 }, e: { r, c: 5 } })),
    // Metadata right labels (cols 6-7)
    ...metaRightRows.map(r => ({ s: { r, c: 6 }, e: { r, c: 7 } })),
    // Metadata right values (cols 8-10)
    ...metaRightRows.map(r => ({ s: { r, c: 8 }, e: { r, c: 10 } })),
    // Table header PRESENTACIÓN (cols 6-7)
    { s: { r: 20, c: 6 }, e: { r: 20, c: 7 } },
    // Summary rows 0-1: label merged (cols 0-7)
    { s: { r: SUM_START, c: 0 }, e: { r: SUM_START, c: 7 } },
    { s: { r: SUM_START + 1, c: 0 }, e: { r: SUM_START + 1, c: 7 } },
    // Summary rows 2-3: label merged (cols 0-11)
    { s: { r: SUM_START + 2, c: 0 }, e: { r: SUM_START + 2, c: 11 } },
    { s: { r: SUM_START + 3, c: 0 }, e: { r: SUM_START + 3, c: 11 } },
    // Summary row 4: label (cols 0-7), second label (cols 8-10)
    { s: { r: SUM_START + 4, c: 0 }, e: { r: SUM_START + 4, c: 7 } },
    { s: { r: SUM_START + 4, c: 8 }, e: { r: SUM_START + 4, c: 10 } },
    // Distribution header
    { s: { r: DIST_START, c: 9 }, e: { r: DIST_START, c: 12 } },
  ]

  // ── Anchos de columna ─────────────────────

  ws['!cols'] = [
    { wch: 10 },  // A: PALLET
    { wch: 24 },  // B: TRAZABILIDAD
    { wch: 16 },  // C: GGN
    { wch: 14 },  // D: VARIEDAD
    { wch: 16 },  // E: MARCA DE CAJA
    { wch: 10 },  // F: CAT
    { wch: 34 },  // G: PRESENTACIÓN
    { wch: 3 },   // H
    { wch: 10 },  // I: S/C
    { wch: 8 },   // J
    { wch: 8 },   // K
    { wch: 12 },  // L
    { wch: 10 },  // M: TOTAL
    { wch: 14 },  // N
  ]

  // ── Alturas de fila ───────────────────────

  ws['!rows'] = []
  for (let r = 0; r <= 3; r++) ws['!rows'][r] = { hpx: 22 }
  ws['!rows'][20] = { hpx: 30 }

  // ── Escribir archivo ──────────────────────

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1')

  const fechaStr = despacho.fecha_despacho.replace(/-/g, '')
  const filename = `PACKING_LIST_${despacho.codigo}_${fechaStr}.xlsx`
  XLSX.writeFile(wb, filename)
}

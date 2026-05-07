import * as XLSX from 'xlsx-js-style'
import type { LiquidacionAgri } from '@/types/models'
import { formatFecha } from './formatters'
import { getISOWeek, parseISO } from 'date-fns'

export function generateLiquidacionesAgriConsolidadoExcel(params: {
  fechaDesde: string
  fechaHasta: string
  liquidaciones: LiquidacionAgri[]
}): void {
  const { fechaDesde, fechaHasta, liquidaciones } = params

  type AgriAgg = {
    codigoAgricultor: string
    agricultorNombre: string
    cantidadLiquidaciones: number
    semanasIso: Set<number>
    totalKg: number
    totalMonto: number
  }

  const agriMap = new Map<string, AgriAgg>()

  for (const liq of liquidaciones) {
    const key = liq.agricultor_id
    const codigoAgricultor = liq.agricultor?.codigo ?? liq.agricultor_id
    const agricultorNombre = liq.agricultor
      ? `${liq.agricultor.apellido}, ${liq.agricultor.nombre}`
      : liq.agricultor_id

    const current = agriMap.get(key) ?? {
      codigoAgricultor,
      agricultorNombre,
      cantidadLiquidaciones: 0,
      semanasIso: new Set<number>(),
      totalKg: 0,
      totalMonto: 0,
    }

    current.cantidadLiquidaciones += 1
    current.totalKg += Number(liq.total_kg ?? 0)
    current.totalMonto += Number(liq.total_monto ?? 0)
    current.semanasIso.add(safeIsoWeek(liq.fecha_inicio))
    current.semanasIso.add(safeIsoWeek(liq.fecha_fin))

    agriMap.set(key, current)
  }

  const rows: Array<Array<string | number>> = [
    ['Consolidado semanal de liquidaciones de agricultores'],
    ['Rango', `${formatFecha(fechaDesde)} - ${formatFecha(fechaHasta)}`],
    ['Total agricultores', agriMap.size],
    ['Total liquidaciones', liquidaciones.length],
    [],
    [
      '#',
      'Codigo agricultor',
      'Apellidos y Nombres',
      'Semanas ISO',
      'N° liquidaciones',
      'Kg total',
      'Monto total S/',
      'Precio promedio S/kg',
    ],
  ]

  const agriRows = Array.from(agriMap.values())
    .sort((a, b) => a.agricultorNombre.localeCompare(b.agricultorNombre))
    .map((agri, index) => {
      const precioPromedio = agri.totalKg > 0 ? agri.totalMonto / agri.totalKg : 0

      return [
        index + 1,
        agri.codigoAgricultor,
        agri.agricultorNombre,
        Array.from(agri.semanasIso).filter((w) => w > 0).sort((a, b) => a - b).join(', ') || '-',
        agri.cantidadLiquidaciones,
        round2(agri.totalKg),
        round2(agri.totalMonto),
        round4(precioPromedio),
      ] as Array<string | number>
    })

  rows.push(...agriRows)

  if (agriRows.length > 0) {
    const totalKg = agriRows.reduce((acc, row) => acc + Number(row[5] ?? 0), 0)
    const totalMonto = agriRows.reduce((acc, row) => acc + Number(row[6] ?? 0), 0)
    const precioPromedio = totalKg > 0 ? totalMonto / totalKg : 0

    rows.push([])
    rows.push([
      '',
      '',
      'TOTAL GENERAL',
      '',
      liquidaciones.length,
      round2(totalKg),
      round2(totalMonto),
      round4(precioPromedio),
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 5 },
    { wch: 18 },
    { wch: 32 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
  ]

  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1F4E3D' } },
    alignment: { horizontal: 'center' },
  }

  for (let c = 0; c <= 7; c++) {
    const ref = XLSX.utils.encode_cell({ r: 5, c })
    if (ws[ref]) ws[ref].s = headerStyle
  }

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1')
  for (let r = 6; r <= range.e.r; r++) {
    const labelRef = XLSX.utils.encode_cell({ r, c: 2 })
    const label = ws[labelRef]?.v
    if (label !== 'TOTAL GENERAL') continue

    for (let c = 0; c <= 7; c++) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (ws[ref]) {
        ws[ref].s = { font: { bold: true, color: { rgb: '1F4E3D' } } }
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Consolidado semanal')
  XLSX.writeFile(wb, `liquidaciones-agricultores-${fechaDesde}-${fechaHasta}.xlsx`)
}

export function generateLiquidacionAgriExcel(liquidacion: LiquidacionAgri): void {
  const agricultorCodigo = liquidacion.agricultor?.codigo ?? liquidacion.agricultor_id
  const agricultorNombre = liquidacion.agricultor
    ? `${liquidacion.agricultor.apellido}, ${liquidacion.agricultor.nombre}`
    : liquidacion.agricultor_id

  const detalles = liquidacion.detalles ?? []

  type GroupAgg = {
    fechaProceso: string
    semanaIso: number
    codigoAgricultor: string
    agricultorNombre: string
    acopiador: string
    variedad: string
    loteIds: Set<string>
    lotesInfo: Map<string, { numCubetas: number; pesoNetoKg: number }>
    kgExportableConfirmado: number
    montoTotal: number
  }

  const groups = new Map<string, GroupAgg>()

  for (const d of detalles) {
    const lote = d.lote
    const fechaProceso = lote?.fecha_ingreso ?? liquidacion.fecha_fin
    const semanaIso = safeIsoWeek(fechaProceso)
    const variedadRaw = lote?.producto?.variedad
    const variedad = formatVariedad(variedadRaw)
    const acopiador = formatAcopiador(lote)
    const key = [fechaProceso, acopiador, variedad].join('|')

    const current = groups.get(key) ?? {
      fechaProceso,
      semanaIso,
      codigoAgricultor: agricultorCodigo,
      agricultorNombre,
      acopiador,
      variedad,
      loteIds: new Set<string>(),
      lotesInfo: new Map<string, { numCubetas: number; pesoNetoKg: number }>(),
      kgExportableConfirmado: 0,
      montoTotal: 0,
    }

    current.kgExportableConfirmado += Number(d.peso_kg ?? 0)
    current.montoTotal += Number(d.subtotal ?? 0)

    const loteId = d.lote_id
    current.loteIds.add(loteId)

    if (!current.lotesInfo.has(loteId)) {
      current.lotesInfo.set(loteId, {
        numCubetas: Number(lote?.num_cubetas ?? 0),
        pesoNetoKg: Number(lote?.peso_neto_kg ?? 0),
      })
    }

    groups.set(key, current)
  }

  const groupedRows = Array.from(groups.values())
    .map((g) => {
      const nLotesDia = g.loteIds.size
      let nJabasTotales = 0
      let kgPesoNetoMp = 0

      for (const info of g.lotesInfo.values()) {
        nJabasTotales += info.numCubetas
        kgPesoNetoMp += info.pesoNetoKg
      }

      const rendimiento = kgPesoNetoMp > 0 ? g.kgExportableConfirmado / kgPesoNetoMp : 0
      const precioAcordado = g.kgExportableConfirmado > 0 ? g.montoTotal / g.kgExportableConfirmado : 0

      return {
        ...g,
        nLotesDia,
        nJabasTotales,
        kgPesoNetoMp,
        rendimiento,
        precioAcordado,
      }
    })
    .sort((a, b) => {
      if (a.fechaProceso !== b.fechaProceso) return a.fechaProceso.localeCompare(b.fechaProceso)
      if (a.acopiador !== b.acopiador) return a.acopiador.localeCompare(b.acopiador)
      return a.variedad.localeCompare(b.variedad)
    })

  const rows: Array<Array<string | number>> = [
    ['Reporte Diario de Liquidacion Agricultor (segun datos actuales del sistema)'],
    ['Liquidacion', liquidacion.codigo],
    ['Periodo', `${formatFecha(liquidacion.fecha_inicio)} - ${formatFecha(liquidacion.fecha_fin)}`],
    ['Estado', liquidacion.estado],
    ['Fecha pago', liquidacion.fecha_pago ? formatFecha(liquidacion.fecha_pago) : '-'],
    ['Numero operacion', liquidacion.numero_operacion ?? '-'],
    ['Modalidad', formatModalidad(liquidacion.modalidad_pago)],
    [],
    [
      '#',
      'Fecha de proceso',
      'Semana ISO',
      'Codigo agricultor',
      'Apellidos y Nombres',
      'Acopiador',
      'N° Lotes del dia',
      'N° Jabas totales',
      'Kg Peso Neto MP',
      'Kg Exportable confirmado',
      '% Rendimiento exportable',
      'Variedad',
      'Precio S/kg acordado',
    ],
  ]

  let item = 1
  let prevFecha = ''
  let prevAcopiador = ''
  let subtotalRows: typeof groupedRows = []
  let dayRows: typeof groupedRows = []

  const pushSubtotalAcopiador = () => {
    if (subtotalRows.length === 0) return
    rows.push(buildSubtotalRow(`SUBTOTAL ${prevAcopiador}`, subtotalRows))
    rows.push([])
    subtotalRows = []
  }

  const pushTotalDia = () => {
    if (dayRows.length === 0) return
    rows.push(buildSubtotalRow(`GRAN TOTAL DIA ${formatFecha(prevFecha)}`, dayRows))
    rows.push([])
    dayRows = []
  }

  for (const r of groupedRows) {
    if (prevFecha && (r.fechaProceso !== prevFecha || r.acopiador !== prevAcopiador)) {
      pushSubtotalAcopiador()
    }
    if (prevFecha && r.fechaProceso !== prevFecha) {
      pushTotalDia()
    }

    rows.push([
      item,
      formatFecha(r.fechaProceso),
      r.semanaIso,
      r.codigoAgricultor,
      r.agricultorNombre,
      r.acopiador,
      r.nLotesDia,
      r.nJabasTotales,
      round2(r.kgPesoNetoMp),
      round2(r.kgExportableConfirmado),
      round4(r.rendimiento),
      r.variedad,
      round4(r.precioAcordado),
    ])

    subtotalRows.push(r)
    dayRows.push(r)
    prevFecha = r.fechaProceso
    prevAcopiador = r.acopiador
    item += 1
  }

  pushSubtotalAcopiador()
  pushTotalDia()

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 5 },
    { wch: 16 },
    { wch: 10 },
    { wch: 18 },
    { wch: 28 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 15 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
  ]

  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1F4E3D' } },
    alignment: { horizontal: 'center' },
  }

  for (let c = 0; c <= 12; c++) {
    const ref = XLSX.utils.encode_cell({ r: 8, c })
    if (ws[ref]) ws[ref].s = headerStyle
  }

  const strongStyle = {
    font: { bold: true, color: { rgb: '1F4E3D' } },
  }

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1')
  for (let r = 9; r <= range.e.r; r++) {
    const labelRef = XLSX.utils.encode_cell({ r, c: 5 })
    const cell = ws[labelRef]
    if (!cell || typeof cell.v !== 'string') continue
    if (!cell.v.startsWith('SUBTOTAL ') && !cell.v.startsWith('GRAN TOTAL DIA ')) continue
    for (let c = 0; c <= 12; c++) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (ws[ref]) ws[ref].s = strongStyle
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte diario')
  XLSX.writeFile(wb, `${liquidacion.codigo}-reporte-diario.xlsx`)
}

function safeIsoWeek(isoDate: string): number {
  try {
    return getISOWeek(parseISO(isoDate))
  } catch {
    return 0
  }
}

function formatVariedad(variedad?: string | null): string {
  if (variedad === 'snow_peas') return 'Snow Peas'
  if (variedad === 'sugar') return 'Sugar Snap'
  return '-'
}

function formatAcopiador(lote?: NonNullable<LiquidacionAgri['detalles']>[number]['lote']): string {
  if (!lote) return '-'

  const acopiador = lote.acopiador
  if (acopiador) {
    const nombre = [acopiador.apellido, acopiador.nombre].filter(Boolean).join(', ').trim()
    if (nombre) return nombre
  }

  const acopiadorAgri = lote.acopiador_agricultor
  if (acopiadorAgri) {
    const nombre = [acopiadorAgri.apellido, acopiadorAgri.nombre].filter(Boolean).join(', ').trim()
    if (nombre) return nombre
  }

  return '-'
}

function buildSubtotalRow(
  label: string,
  rows: Array<{
    nLotesDia: number
    nJabasTotales: number
    kgPesoNetoMp: number
    kgExportableConfirmado: number
    montoTotal: number
  }>
): Array<string | number> {
  const nLotes = rows.reduce((acc, r) => acc + r.nLotesDia, 0)
  const nJabas = rows.reduce((acc, r) => acc + r.nJabasTotales, 0)
  const kgNeto = rows.reduce((acc, r) => acc + r.kgPesoNetoMp, 0)
  const kgExp = rows.reduce((acc, r) => acc + r.kgExportableConfirmado, 0)
  const monto = rows.reduce((acc, r) => acc + r.montoTotal, 0)
  const rendimiento = kgNeto > 0 ? kgExp / kgNeto : 0
  const precioAcordado = kgExp > 0 ? monto / kgExp : 0

  return [
    '',
    '',
    '',
    '',
    '',
    label,
    nLotes,
    nJabas,
    round2(kgNeto),
    round2(kgExp),
    round4(rendimiento),
    '',
    round4(precioAcordado),
  ]
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function formatModalidad(modalidad: LiquidacionAgri['modalidad_pago']): string {
  if (modalidad === 'transferencia') return 'Transferencia'
  if (modalidad === 'yape_plin') return 'Yape/Plin'
  if (modalidad === 'efectivo') return 'Efectivo'
  return '-'
}

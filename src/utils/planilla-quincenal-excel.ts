import * as XLSX from 'xlsx-js-style'
import type { PlanillaQuincenal } from '@/types/models'
import { formatFecha } from './formatters'

export function generatePlanillaQuincenalExcel(planilla: PlanillaQuincenal): void {
  const detalles = planilla.detalles ?? []
  const periodo = `${formatFecha(planilla.periodo_inicio)} - ${formatFecha(planilla.periodo_fin)}`

  const rows: Array<Array<string | number>> = [
    ['Reporte 2 - Pago de Personal segun Tareo (con datos actuales disponibles)'],
    ['Periodo', periodo],
    ['Estado', planilla.estado],
    ['Total (S/)', planilla.total_monto],
    ['Fecha pago', planilla.fecha_pago ? formatFecha(planilla.fecha_pago) : '-'],
    ['Numero operacion', planilla.numero_operacion ?? '-'],
    ['Modalidad', formatModalidad(planilla.modalidad_pago)],
    ['Observaciones', planilla.observaciones ?? '-'],
    [],
    [
      '#',
      'Periodo',
      'DNI',
      'Apellidos y Nombres',
      'Labor principal',
      'Dias trabajados',
      'Kg recepcionados',
      'Pago recepcion S/',
      'Kg seleccion Cat 1',
      'Kg seleccion Cat 2',
      'Pago seleccion S/',
      'Cajas empaquetadas',
      'Pago empaque S/',
      'Otros pagos S/',
      'Total bruto S/',
      'Adelantos descontados S/',
      'Total neto a pagar S/',
      'Medio de pago',
      'N° cuenta / Yape',
      'Estado',
      'N° operacion / fecha pago',
    ],
  ]

  const dataRows = detalles.map((d, index) => {
    const kgRecepcionados = Number(d.kg_bruto_recepcion ?? 0)
    const pagoRecepcion = Number(d.pago_recepcion ?? 0)
    const kgCat1 = Number(d.kg_cat1_seleccion ?? 0)
    const kgCat2 = Number(d.kg_cat2_seleccion ?? 0)
    const pagoSeleccion = Number(d.pago_seleccion ?? 0)
    const cajasEmpaquetadas = Number(d.n_cajas_empaquetado ?? 0)
    const pagoEmpaque = Number(d.monto_empaquetado ?? 0)
    const otrosPagos = Number(d.otros_montos ?? 0)
    const totalBruto = Number(d.total ?? 0)
    // Aun no existe módulo de adelantos para personal: queda en 0 por ahora.
    const adelantos = 0
    const totalNeto = totalBruto - adelantos
    const diasTrabajados = '-'
    const colaboradorNombre = d.colaborador
      ? `${d.colaborador.apellido}, ${d.colaborador.nombre}`
      : d.colaborador_id

    const numeroOperacionFechaPago = planilla.numero_operacion
      ? `${planilla.numero_operacion} / ${planilla.fecha_pago ? formatFecha(planilla.fecha_pago) : '-'}`
      : planilla.fecha_pago
        ? `- / ${formatFecha(planilla.fecha_pago)}`
        : '-'

    return [
      index + 1,
      periodo,
      d.colaborador?.dni ?? '-',
      colaboradorNombre,
      determinarLaborPrincipal({ kgRecepcionados, kgCat1, kgCat2, cajasEmpaquetadas, otrosPagos }),
      diasTrabajados,
      round2(kgRecepcionados),
      round2(pagoRecepcion),
      round2(kgCat1),
      round2(kgCat2),
      round2(pagoSeleccion),
      Math.round(cajasEmpaquetadas),
      round2(pagoEmpaque),
      round2(otrosPagos),
      round2(totalBruto),
      round2(adelantos),
      round2(totalNeto),
      formatModalidad(planilla.modalidad_pago),
      d.colaborador?.numero_cuenta ?? '-',
      formatEstado(planilla.estado),
      numeroOperacionFechaPago,
    ] as Array<string | number>
  })

  rows.push(...dataRows)

  if (dataRows.length > 0) {
    const totals = buildTotals(detalles)
    rows.push([])
    rows.push([
      '',
      '',
      '',
      '',
      '',
      'TOTAL',
      totals.kgRecepcionados,
      totals.pagoRecepcion,
      totals.kgCat1,
      totals.kgCat2,
      totals.pagoSeleccion,
      totals.cajasEmpaquetadas,
      totals.pagoEmpaque,
      totals.otrosPagos,
      totals.totalBruto,
      0,
      totals.totalBruto,
      '',
      '',
      '',
      '',
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 5 },
    { wch: 24 },
    { wch: 14 },
    { wch: 30 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 15 },
    { wch: 15 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 24 },
  ]

  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1F4E3D' } },
    alignment: { horizontal: 'center' },
  }

  for (let c = 0; c <= 20; c++) {
    const ref = XLSX.utils.encode_cell({ r: 9, c })
    if (ws[ref]) ws[ref].s = headerStyle
  }

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1')
  for (let r = 10; r <= range.e.r; r++) {
    const totalLabelRef = XLSX.utils.encode_cell({ r, c: 5 })
    if (ws[totalLabelRef]?.v !== 'TOTAL') continue
    for (let c = 0; c <= 20; c++) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (ws[ref]) {
        ws[ref].s = { font: { bold: true, color: { rgb: '1F4E3D' } } }
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte planilla')
  XLSX.writeFile(wb, `planilla-reporte-${planilla.periodo_inicio}-${planilla.periodo_fin}.xlsx`)
}

function formatModalidad(modalidad: PlanillaQuincenal['modalidad_pago']): string {
  if (modalidad === 'transferencia') return 'Transferencia'
  if (modalidad === 'yape_plin') return 'Yape/Plin'
  if (modalidad === 'efectivo') return 'Efectivo'
  return '-'
}

function formatEstado(estado: PlanillaQuincenal['estado']): string {
  if (estado === 'borrador') return 'Borrador'
  if (estado === 'confirmada') return 'Aprobado por Admin'
  if (estado === 'pagada') return 'Pagado por Tesoreria'
  return estado
}

function determinarLaborPrincipal(input: {
  kgRecepcionados: number
  kgCat1: number
  kgCat2: number
  cajasEmpaquetadas: number
  otrosPagos: number
}): string {
  const seleccionKg = input.kgCat1 + input.kgCat2
  const candidates: Array<{ labor: string; valor: number }> = [
    { labor: 'Recepcion', valor: input.kgRecepcionados },
    { labor: 'Seleccion', valor: seleccionKg },
    { labor: 'Empaque', valor: input.cajasEmpaquetadas },
    { labor: 'Otros', valor: input.otrosPagos },
  ]

  const top = candidates.reduce((best, cur) => (cur.valor > best.valor ? cur : best), candidates[0])
  return top.valor > 0 ? top.labor : '-'
}

function buildTotals(detalles: NonNullable<PlanillaQuincenal['detalles']>) {
  const sum = (selector: (d: NonNullable<PlanillaQuincenal['detalles']>[number]) => number) =>
    round2(detalles.reduce((acc, d) => acc + selector(d), 0))

  return {
    kgRecepcionados: sum((d) => Number(d.kg_bruto_recepcion ?? 0)),
    pagoRecepcion: sum((d) => Number(d.pago_recepcion ?? 0)),
    kgCat1: sum((d) => Number(d.kg_cat1_seleccion ?? 0)),
    kgCat2: sum((d) => Number(d.kg_cat2_seleccion ?? 0)),
    pagoSeleccion: sum((d) => Number(d.pago_seleccion ?? 0)),
    cajasEmpaquetadas: Math.round(detalles.reduce((acc, d) => acc + Number(d.n_cajas_empaquetado ?? 0), 0)),
    pagoEmpaque: sum((d) => Number(d.monto_empaquetado ?? 0)),
    otrosPagos: sum((d) => Number(d.otros_montos ?? 0)),
    totalBruto: sum((d) => Number(d.total ?? 0)),
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

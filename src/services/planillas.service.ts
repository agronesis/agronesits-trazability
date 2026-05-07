import { supabase } from '@/lib/supabase'
import type {
  PlanillaQuincenal, PlanillaQuincenalInsert,
  PlanillaDetalleInsert,
  ModalidadPago,
} from '@/types/models'

// ─── Planillas ───────────────────────────────────────────────────────────────

export async function getPlanillasQuincenales(): Promise<PlanillaQuincenal[]> {
  const { data, error } = await supabase
    .from('planillas_quincenales')
    .select('*')
    .order('periodo_inicio', { ascending: false })

  if (error) throw new Error(error.message)
  return data as PlanillaQuincenal[]
}

export async function getPlanillaConDetalles(id: string): Promise<PlanillaQuincenal> {
  const { data, error } = await supabase
    .from('planillas_quincenales')
    .select('*, detalles:planilla_detalles(*, colaborador:colaboradores(id, dni, nombre, apellido, numero_cuenta))')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as PlanillaQuincenal
}

export async function createPlanillaQuincenal(
  planilla: PlanillaQuincenalInsert,
  detalles: PlanillaDetalleInsert[],
  userId: string
): Promise<PlanillaQuincenal> {
  const { data: planData, error: planError } = await supabase
    .from('planillas_quincenales')
    .insert({ ...planilla, created_by: userId, fecha_pago: planilla.fecha_pago ?? null, numero_operacion: planilla.numero_operacion ?? null, modalidad_pago: planilla.modalidad_pago ?? null })
    .select()
    .single()

  if (planError) throw new Error(planError.message)

  if (detalles.length > 0) {
    const rows = detalles.map((d) => ({ ...d, planilla_id: planData.id, created_by: userId }))
    const { error: detError } = await supabase.from('planilla_detalles').insert(rows)
    if (detError) {
      // Roll back the planilla header to avoid orphan rows on retry
      await supabase.from('planillas_quincenales').delete().eq('id', planData.id)
      throw new Error(detError.message)
    }
  }

  return planData as PlanillaQuincenal
}

export async function actualizarEstadoPlanilla(
  id: string,
  estado: 'borrador' | 'confirmada' | 'pagada'
): Promise<PlanillaQuincenal> {
  const { data, error } = await supabase
    .from('planillas_quincenales')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as PlanillaQuincenal
}

export async function pagarPlanilla(
  id: string,
  pago: { fecha_pago: string; numero_operacion: string; modalidad_pago: ModalidadPago }
): Promise<void> {
  const { error } = await supabase
    .from('planillas_quincenales')
    .update({
      estado: 'pagada',
      fecha_pago: pago.fecha_pago,
      numero_operacion: pago.numero_operacion,
      modalidad_pago: pago.modalidad_pago,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/**
 * Actualiza una planilla en estado borrador.
 * Solo permite actualizar si la planilla está en borrador.
 */
export async function updatePlanillaQuincenal(
  id: string,
  input: Partial<PlanillaQuincenalInsert>,
  detalles: PlanillaDetalleInsert[] | undefined,
  userId: string
): Promise<PlanillaQuincenal> {
  // Verificar que esté en borrador
  const current = await getPlanillaConDetalles(id)
  if (current.estado !== 'borrador') {
    throw new Error('No se puede editar una planilla que no está en borrador')
  }

  // Actualizar planilla
  const updateData: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  }
  const { error: updateError } = await supabase
    .from('planillas_quincenales')
    .update(updateData)
    .eq('id', id)

  if (updateError) throw new Error(updateError.message)

  // Si se proporciona detalles, actualizar
  if (detalles !== undefined) {
    // Eliminar detalles anteriores
    const { error: deleteError } = await supabase
      .from('planilla_detalles')
      .delete()
      .eq('planilla_id', id)

    if (deleteError) throw new Error(deleteError.message)

    // Insertar nuevos detalles
    if (detalles.length > 0) {
      const { error: insertError } = await supabase
        .from('planilla_detalles')
        .insert(detalles.map((d) => ({ ...d, planilla_id: id, created_by: userId })))

      if (insertError) throw new Error(insertError.message)
    }
  }

  return getPlanillaConDetalles(id)
}

/**
 * Elimina una planilla en estado borrador.
 */
export async function deletePlanillaQuincenal(id: string): Promise<void> {
  // Verificar que esté en borrador
  const current = await getPlanillaConDetalles(id)
  if (current.estado !== 'borrador') {
    throw new Error('No se puede eliminar una planilla que no está en borrador')
  }

  // Eliminar detalles primero
  const { error: detError } = await supabase
    .from('planilla_detalles')
    .delete()
    .eq('planilla_id', id)

  if (detError) throw new Error(detError.message)

  // Eliminar planilla
  const { error } = await supabase
    .from('planillas_quincenales')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/**
 * Retorna los colaborador_id que ya aparecen en planillas cuyo período
 * se solapa con [fechaInicio, fechaFin], para evitar doble conteo.
 */
export async function getColaboradoresYaLiquidados(
  fechaInicio: string,
  fechaFin: string,
  planillaIdExcluir?: string
): Promise<Set<string>> {
  // Planillas con rango solapado: periodo_fin >= fechaInicio AND periodo_inicio <= fechaFin
  let query = supabase
    .from('planillas_quincenales')
    .select('id')
    .lte('periodo_inicio', fechaFin)
    .gte('periodo_fin', fechaInicio)

  if (planillaIdExcluir) {
    query = query.neq('id', planillaIdExcluir)
  }

  const { data: planillas, error: errP } = await query

  if (errP) throw new Error(errP.message)
  if (!planillas || planillas.length === 0) return new Set()

  const ids = planillas.map((p) => p.id)

  const { data: detalles, error: errD } = await supabase
    .from('planilla_detalles')
    .select('colaborador_id')
    .in('planilla_id', ids)

  if (errD) throw new Error(errD.message)

  return new Set((detalles ?? []).map((d) => d.colaborador_id as string))
}

export async function existePlanillaSolapada(
  fechaInicio: string,
  fechaFin: string,
  planillaIdExcluir?: string
): Promise<boolean> {
  let query = supabase
    .from('planillas_quincenales')
    .select('id', { count: 'exact', head: true })
    .lte('periodo_inicio', fechaFin)
    .gte('periodo_fin', fechaInicio)

  if (planillaIdExcluir) {
    query = query.neq('id', planillaIdExcluir)
  }

  const { count, error } = await query
  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

// ─── Resumen por colaborador para pre-llenar planilla ─────────────────────────

export interface ResumenColaboradorPeriodo {
  colaborador_id: string
  nombre: string
  apellido: string
  kg_bruto_recepcion: number
  pago_recepcion: number
  kg_cat1_seleccion: number
  kg_cat2_seleccion: number
  pago_seleccion: number
  n_cajas_empaquetado: number
  pago_empaquetado: number
}

export async function getResumenColaboradoresPeriodo(
  fechaInicio: string,
  fechaFin: string,
  pagoRecepcionKg = 0.02,
  pagoEmpaquetadoCaja = 0.32
): Promise<ResumenColaboradorPeriodo[]> {
  const mapa = new Map<string, ResumenColaboradorPeriodo>()

  // 0. Recepción del período (kg brutos de lotes por recepcionista)
  const { data: lotes, error: errLotes } = await supabase
    .from('lotes')
    .select('recepcionista_id, peso_bruto_kg, recepcionista:colaboradores(nombre, apellido)')
    .not('recepcionista_id', 'is', null)
    .gte('fecha_ingreso', fechaInicio)
    .lte('fecha_ingreso', fechaFin)
  if (errLotes) throw new Error(errLotes.message)

  for (const row of (lotes ?? []) as any[]) {
    const cid = row.recepcionista_id as string | null
    if (!cid) continue

    if (!mapa.has(cid)) {
      mapa.set(cid, {
        colaborador_id: cid,
        nombre: row.recepcionista?.nombre ?? '',
        apellido: row.recepcionista?.apellido ?? '',
        kg_bruto_recepcion: 0,
        pago_recepcion: 0,
        kg_cat1_seleccion: 0,
        kg_cat2_seleccion: 0,
        pago_seleccion: 0,
        n_cajas_empaquetado: 0,
        pago_empaquetado: 0,
      })
    }

    const entry = mapa.get(cid)!
    entry.kg_bruto_recepcion += Number(row.peso_bruto_kg ?? 0)
  }

  // 1. Aportes de selección del período
  const { data: sesiones, error: errSes } = await supabase
    .from('clasificaciones')
    .select('id')
    .gte('fecha_clasificacion', fechaInicio)
    .lte('fecha_clasificacion', fechaFin)
  if (errSes) throw new Error(errSes.message)

  if ((sesiones ?? []).length > 0) {
    const clasificacionIds = (sesiones as { id: string }[]).map((s) => s.id)
    const { data: aportes, error: errAp } = await supabase
      .from('clasificacion_aportes')
      .select('colaborador_id, kg_cat1, kg_cat2, colaborador:colaboradores(nombre, apellido)')
      .in('clasificacion_id', clasificacionIds)
    if (errAp) throw new Error(errAp.message)

    for (const row of aportes as any[]) {
      const cid = row.colaborador_id
      if (!mapa.has(cid)) {
        mapa.set(cid, {
          colaborador_id: cid,
          nombre: row.colaborador?.nombre ?? '',
          apellido: row.colaborador?.apellido ?? '',
          kg_bruto_recepcion: 0,
          pago_recepcion: 0,
          kg_cat1_seleccion: 0,
          kg_cat2_seleccion: 0,
          pago_seleccion: 0,
          n_cajas_empaquetado: 0,
          pago_empaquetado: 0,
        })
      }
      const entry = mapa.get(cid)!
      entry.kg_cat1_seleccion += row.kg_cat1 ?? 0
      entry.kg_cat2_seleccion += row.kg_cat2 ?? 0
    }
    mapa.forEach((entry) => {
      entry.pago_seleccion = Math.round(
        (entry.kg_cat1_seleccion * 0.20 + entry.kg_cat2_seleccion * 0.28) * 100
      ) / 100
    })
  }

  mapa.forEach((entry) => {
    entry.kg_bruto_recepcion = Math.round(entry.kg_bruto_recepcion * 100) / 100
    entry.pago_recepcion = Math.round(entry.kg_bruto_recepcion * pagoRecepcionKg * 100) / 100
  })

  // 2. Empaquetado del período — lotes despachados con fecha_empaquetado en el rango
  const { data: empaquetados, error: errEmp } = await supabase
    .from('empaquetados')
    .select('colaborador_id, num_cajas, colaborador:colaboradores(nombre, apellido), lote:lotes(estado)')
    .not('colaborador_id', 'is', null)
    .gte('fecha_empaquetado', fechaInicio)
    .lte('fecha_empaquetado', fechaFin)
  if (errEmp) throw new Error(errEmp.message)

  for (const row of (empaquetados ?? []) as any[]) {
    const cid = row.colaborador_id as string | null
    if (!cid) continue
    if (!mapa.has(cid)) {
      mapa.set(cid, {
        colaborador_id: cid,
        nombre: row.colaborador?.nombre ?? '',
        apellido: row.colaborador?.apellido ?? '',
        kg_bruto_recepcion: 0,
        pago_recepcion: 0,
        kg_cat1_seleccion: 0,
        kg_cat2_seleccion: 0,
        pago_seleccion: 0,
        n_cajas_empaquetado: 0,
        pago_empaquetado: 0,
      })
    }
    const entry = mapa.get(cid)!
    entry.n_cajas_empaquetado += row.num_cajas ?? 0
  }

  mapa.forEach((entry) => {
    entry.n_cajas_empaquetado = Math.round(entry.n_cajas_empaquetado)
    entry.pago_empaquetado = Math.round(entry.n_cajas_empaquetado * pagoEmpaquetadoCaja * 100) / 100
  })

  return Array.from(mapa.values()).sort((a, b) =>
    a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre)
  )
}


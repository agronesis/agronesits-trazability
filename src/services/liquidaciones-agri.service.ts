import { supabase } from '@/lib/supabase'
import type {
  LiquidacionAgri,
  LiquidacionAgriInsert,
  LiquidacionAgriDetalleInsert,
  ModalidadPago,
} from '@/types/models'

const TABLE = 'liquidaciones_agri' as const

export async function getLiquidacionesAgri(): Promise<LiquidacionAgri[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, agricultor:agricultores(*)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as unknown as LiquidacionAgri[]
}

export async function getLiquidacionAgri(id: string): Promise<LiquidacionAgri> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(`
      *,
      agricultor:agricultores(*),
      detalles:liquidacion_agri_detalle(
        *,
        lote:lotes(
          codigo,
          fecha_ingreso,
          num_cubetas,
          peso_neto_kg,
          producto:productos(variedad),
          acopiador:acopiadores(codigo, nombre, apellido),
          acopiador_agricultor:agricultores!lotes_acopiador_agricultor_id_fkey(codigo, nombre, apellido)
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as LiquidacionAgri
}

export async function createLiquidacionAgri(
  input: LiquidacionAgriInsert,
  detalles: LiquidacionAgriDetalleInsert[],
  userId: string
): Promise<LiquidacionAgri> {
  const { data: liq, error: liqError } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId, fecha_pago: input.fecha_pago ?? null, numero_operacion: input.numero_operacion ?? null, modalidad_pago: input.modalidad_pago ?? null })
    .select()
    .single()

  if (liqError) throw new Error(liqError.message)

  const { error: detError } = await supabase
    .from('liquidacion_agri_detalle')
    .insert(detalles.map((d) => ({ ...d, liquidacion_id: liq.id, created_by: userId })))

  if (detError) throw new Error(detError.message)

  return getLiquidacionAgri(liq.id)
}

export async function actualizarEstadoLiquidacionAgri(
  id: string,
  estado: 'borrador' | 'confirmada' | 'pagada'
): Promise<LiquidacionAgri> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, agricultor:agricultores(*)')
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as LiquidacionAgri
}

/**
 * Marca la liquidación como pagada y actualiza todos sus lotes asociados a 'liquidado'.
 * Llama a esto en lugar de actualizarEstadoLiquidacionAgri cuando el pago es confirmado.
 */
export async function pagarLiquidacionAgri(
  id: string,
  pago: { fecha_pago: string; numero_operacion: string; modalidad_pago: ModalidadPago }
): Promise<LiquidacionAgri> {
  // Traer la liquidación con sus detalles para obtener los lote_ids
  const liquidacion = await getLiquidacionAgri(id)
  const loteIds = [...new Set((liquidacion.detalles ?? []).map((d) => d.lote_id))]

  // Marcar cada lote como liquidado
  if (loteIds.length > 0) {
    const { error } = await supabase
      .from('lotes')
      .update({ estado: 'liquidado', updated_at: new Date().toISOString() })
      .in('id', loteIds)
    if (error) throw new Error(error.message)
  }

  // Marcar la liquidación como pagada
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      estado: 'pagada',
      fecha_pago: pago.fecha_pago,
      numero_operacion: pago.numero_operacion,
      modalidad_pago: pago.modalidad_pago,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, agricultor:agricultores(*)')
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as LiquidacionAgri
}

/**
 * Retorna el conjunto de lote_ids que ya están referenciados en alguna
 * liquidación del agricultor (en cualquier estado: borrador, confirmada, pagada).
 * Sirve para impedir que el mismo lote sea liquidado dos veces.
 */
export async function getLoteIdsEnLiquidacionAgri(agricultorId: string): Promise<Set<string>> {
  const { data: liquidaciones, error: errLiq } = await supabase
    .from(TABLE)
    .select('id')
    .eq('agricultor_id', agricultorId)

  if (errLiq) throw new Error(errLiq.message)
  if (!liquidaciones || liquidaciones.length === 0) return new Set()

  const ids = liquidaciones.map((l) => l.id)

  const { data: detalles, error: errDet } = await supabase
    .from('liquidacion_agri_detalle')
    .select('lote_id')
    .in('liquidacion_id', ids)

  if (errDet) throw new Error(errDet.message)

  return new Set((detalles ?? []).map((d) => d.lote_id as string))
}

/**
 * Retorna los lote_ids que están en OTRAS liquidaciones (no la especificada).
 * Usado al editar una liquidación para no excluir los lotes de la misma liquidación.
 */
export async function getLoteIdsEnOtrasLiquidaciones(agricultorId: string, liquidacionIdActual: string): Promise<Set<string>> {
  const { data: liquidaciones, error: errLiq } = await supabase
    .from(TABLE)
    .select('id')
    .eq('agricultor_id', agricultorId)
    .neq('id', liquidacionIdActual)

  if (errLiq) throw new Error(errLiq.message)
  if (!liquidaciones || liquidaciones.length === 0) return new Set()

  const ids = liquidaciones.map((l) => l.id)

  const { data: detalles, error: errDet } = await supabase
    .from('liquidacion_agri_detalle')
    .select('lote_id')
    .in('liquidacion_id', ids)

  if (errDet) throw new Error(errDet.message)

  return new Set((detalles ?? []).map((d) => d.lote_id as string))
}

/**
 * Actualiza una liquidación en estado borrador (código, fechas, observaciones, detalles).
 * Solo permite actualizar si la liquidación está en borrador.
 */
export async function updateLiquidacionAgri(
  id: string,
  input: Partial<LiquidacionAgriInsert>,
  detalles: LiquidacionAgriDetalleInsert[] | undefined,
  userId: string
): Promise<LiquidacionAgri> {
  // Verificar que esté en borrador
  const current = await getLiquidacionAgri(id)
  if (current.estado !== 'borrador') {
    throw new Error('No se puede editar una liquidación que no está en borrador')
  }

  // Actualizar liquidación
  const updateData: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  }
  const { error: updateError } = await supabase
    .from(TABLE)
    .update(updateData)
    .eq('id', id)

  if (updateError) throw new Error(updateError.message)

  // Si se proporciona detalles, actualizar
  if (detalles !== undefined) {
    // Eliminar detalles anteriores
    const { error: deleteError } = await supabase
      .from('liquidacion_agri_detalle')
      .delete()
      .eq('liquidacion_id', id)

    if (deleteError) throw new Error(deleteError.message)

    // Insertar nuevos detalles
    if (detalles.length > 0) {
      const { error: insertError } = await supabase
        .from('liquidacion_agri_detalle')
        .insert(detalles.map((d) => ({ ...d, liquidacion_id: id, created_by: userId })))

      if (insertError) throw new Error(insertError.message)
    }
  }

  return getLiquidacionAgri(id)
}

/**
 * Elimina una liquidación en estado borrador.
 * Nota: No restaura estado de lotes porque nunca fueron modificados al crear en borrador.
 */
export async function deleteLiquidacionAgri(id: string): Promise<void> {
  // Verificar que esté en borrador
  const current = await getLiquidacionAgri(id)
  if (current.estado !== 'borrador') {
    throw new Error('No se puede eliminar una liquidación que no está en borrador')
  }

  // Eliminar detalles primero
  const { error: detError } = await supabase
    .from('liquidacion_agri_detalle')
    .delete()
    .eq('liquidacion_id', id)

  if (detError) throw new Error(detError.message)

  // Eliminar liquidación
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

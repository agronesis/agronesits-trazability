import { supabase } from '@/lib/supabase'
import type { Clasificacion, ClasificacionAporteInsert } from '@/types/models'

const TABLE = 'clasificaciones' as const
const TABLE_APORTES = 'clasificacion_aportes' as const

/**
 * Devuelve la sesión de clasificación de un lote junto con sus aportes.
 * Retorna un array de 0 ó 1 elemento (para compatibilidad con liquidaciones).
 */
export async function getClasificacionesPorLote(loteId: string): Promise<Clasificacion[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(`
      *,
      aportes:clasificacion_aportes(*, colaborador:colaboradores(id, nombre, apellido, codigo))
    `)
    .eq('lote_id', loteId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data as unknown as Clasificacion[]
}

/**
 * Devuelve las sesiones de clasificación (con sus aportes) de varios lotes en una
 * sola tanda de consultas, troceando los IDs para no exceder el límite de longitud
 * de URL de PostgREST. Evita el patrón N+1 (una petición por lote) que satura el
 * pool de conexiones del navegador y provoca "TypeError: Failed to fetch" cuando
 * hay muchos lotes seleccionados.
 */
export async function getClasificacionesPorLotes(loteIds: string[]): Promise<Clasificacion[]> {
  if (loteIds.length === 0) return []

  const chunkSize = 200
  const all: Clasificacion[] = []

  for (let i = 0; i < loteIds.length; i += chunkSize) {
    const chunk = loteIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from(TABLE)
      .select(`
        *,
        aportes:clasificacion_aportes(*, colaborador:colaboradores(id, nombre, apellido, codigo))
      `)
      .in('lote_id', chunk)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)
    all.push(...((data ?? []) as unknown as Clasificacion[]))
  }

  return all
}

export type ClasificacionResumenRow = {
  lote_id: string
  peso_bueno_kg: number | null
  aportes: Array<{ kg_neto_descartable: number | null }> | null
}

/**
 * Devuelve un resumen (lote_id, peso_bueno_kg y neto descartable de los aportes)
 * de TODAS las clasificaciones, paginando para superar el tope de 1000 filas que
 * PostgREST/Supabase aplica por defecto a cada respuesta. Pensado para vistas
 * agregadas (dashboard, listado) que necesitan todas las sesiones de una vez.
 */
export async function getClasificacionesResumen(): Promise<ClasificacionResumenRow[]> {
  const pageSize = 1000
  const all: ClasificacionResumenRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(`
        lote_id,
        peso_bueno_kg,
        aportes:clasificacion_aportes(kg_neto_descartable)
      `)
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as unknown as ClasificacionResumenRow[]
    all.push(...rows)

    if (rows.length < pageSize) break
    from += pageSize
  }

  return all
}

/**
 * Guarda (upsert) la sesión de clasificación de un lote y reemplaza todos sus aportes.
 */
export async function guardarClasificacion(
  loteId: string,
  fecha: string,
  observaciones: string | null,
  aportes: Array<{
    colaborador_id: string
    kg_bueno: number
    kg_bruto: number
    num_jabas: number
    peso_tara_kg: number
    jabas_descartadas: number
    kg_bruto_descartable: number
    peso_tara_descartable_kg: number
    kg_neto_descartable: number
  }>,
  calidad: 'cat1' | 'cat2',
  userId: string
): Promise<Clasificacion> {
  const totalBuenos = aportes.reduce((acc, a) => acc + a.kg_bueno, 0)

  const payloadBase: Record<string, unknown> = {
    lote_id: loteId,
    fecha_clasificacion: fecha,
    peso_bueno_kg: totalBuenos,
    observaciones,
    created_by: userId,
  }

  const upsertSesion = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(payload as never, { onConflict: 'lote_id' })
      .select('id')
      .single()
    return { data, error }
  }

  let { data: sesion, error: errSesion } = await upsertSesion(payloadBase)

  // Compatibilidad con esquemas antiguos de producción que todavía exigen columnas legacy.
  if (errSesion?.message.includes('peso_kg') && errSesion?.message.toLowerCase().includes('not-null')) {
    ;({ data: sesion, error: errSesion } = await upsertSesion({ ...payloadBase, peso_kg: totalBuenos }))
  }
  if (errSesion?.message.includes('categoria') && errSesion?.message.toLowerCase().includes('not-null')) {
    ;({ data: sesion, error: errSesion } = await upsertSesion({ ...payloadBase, peso_kg: totalBuenos, categoria: 'primera' }))
  }
  if (errSesion?.message.includes('num_cajas') && errSesion?.message.toLowerCase().includes('not-null')) {
    ;({ data: sesion, error: errSesion } = await upsertSesion({
      ...payloadBase,
      peso_kg: totalBuenos,
      categoria: 'primera',
      num_cajas: 0,
    }))
  }

  if (errSesion) throw new Error(errSesion.message)
  const clasificacionId = (sesion as { id: string }).id

  // Reemplazar aportes
  const { error: errDelAportes } = await supabase
    .from(TABLE_APORTES)
    .delete()
    .eq('clasificacion_id', clasificacionId)
  if (errDelAportes) throw new Error(errDelAportes.message)

  if (aportes.length > 0) {
    const rowsAportes: Array<ClasificacionAporteInsert & { created_by: string }> = aportes.map((a) => ({
      clasificacion_id: clasificacionId,
      colaborador_id: a.colaborador_id,
      peso_bueno_kg: a.kg_bueno,
      kg_cat1: calidad === 'cat1' ? a.kg_bueno : 0,
      kg_cat2: calidad === 'cat2' ? a.kg_bueno : 0,
      kg_bruto: a.kg_bruto,
      num_jabas: a.num_jabas,
      peso_tara_kg: a.peso_tara_kg,
      jabas_descartadas: a.jabas_descartadas,
      kg_bruto_descartable: a.kg_bruto_descartable,
      peso_tara_descartable_kg: a.peso_tara_descartable_kg,
      kg_neto_descartable: a.kg_neto_descartable,
      created_by: userId,
    }))
    const { error: errInsAportes } = await supabase.from(TABLE_APORTES).insert(rowsAportes)
    if (errInsAportes) throw new Error(errInsAportes.message)
  }

  // Devolver sesión completa
  const { data, error } = await supabase
    .from(TABLE)
    .select(`
      *,
      aportes:clasificacion_aportes(*, colaborador:colaboradores(id, nombre, apellido, codigo))
    `)
    .eq('id', clasificacionId)
    .single()
  if (error) throw new Error(error.message)
  return data as unknown as Clasificacion
}

export async function deleteClasificacion(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

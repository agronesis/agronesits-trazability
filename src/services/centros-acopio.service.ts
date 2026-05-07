import { supabase } from '@/lib/supabase'
import type { CentroAcopio, CentroAcopioInsert, CentroAcopioUpdate } from '@/types/models'
import { logAudit } from './audit.service'

const TABLE = 'centros_acopio' as const

export async function getCentrosAcopio(): Promise<CentroAcopio[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)
  return data as CentroAcopio[]
}

export async function getCentroAcopio(id: string): Promise<CentroAcopio> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as CentroAcopio
}

export async function createCentroAcopio(
  input: CentroAcopioInsert,
  userId: string,
  userEmail = ''
): Promise<CentroAcopio> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  const centro = data as CentroAcopio

  void logAudit({
    userId,
    userEmail,
    accion: 'crear',
    modulo: 'centros_acopio',
    registroId: centro.id,
    descripcion: `Creó centro de acopio ${centro.nombre} (${centro.codigo})`,
    datosNuevos: centro as unknown as Record<string, unknown>,
  })

  return centro
}

export async function updateCentroAcopio(
  id: string,
  input: CentroAcopioUpdate,
  userId = '',
  userEmail = ''
): Promise<CentroAcopio> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  const centro = data as CentroAcopio

  void logAudit({
    userId,
    userEmail,
    accion: 'actualizar',
    modulo: 'centros_acopio',
    registroId: id,
    descripcion: `Actualizó centro de acopio ${centro.nombre} (${centro.codigo})`,
    datosNuevos: centro as unknown as Record<string, unknown>,
  })

  return centro
}

export async function deleteCentroAcopio(id: string, userId = '', userEmail = ''): Promise<void> {
  let descripcion = `Eliminó centro de acopio (${id})`
  let datosAnteriores: Record<string, unknown> | null = null
  try {
    const centro = await getCentroAcopio(id)
    descripcion = `Eliminó centro de acopio ${centro.nombre} (${centro.codigo})`
    datosAnteriores = centro as unknown as Record<string, unknown>
  } catch {
    // Si falla el fetch previo, continuamos con la eliminación.
  }

  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)

  void logAudit({
    userId,
    userEmail,
    accion: 'eliminar',
    modulo: 'centros_acopio',
    registroId: id,
    descripcion,
    datosAnteriores,
  })
}

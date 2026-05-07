import { supabase } from '@/lib/supabase'
import type { Acopiador, AcopiadorInsert, AcopiadorUpdate } from '@/types/models'
import { logAudit } from './audit.service'

const TABLE = 'acopiadores' as const

export async function getAcopiadores(): Promise<Acopiador[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('apellido', { ascending: true })

  if (error) throw new Error(error.message)
  return data as Acopiador[]
}

export async function createAcopiador(
  input: AcopiadorInsert,
  userId: string,
  userEmail = ''
): Promise<Acopiador> {
  const { codigo: _codigo, ...payload } = input

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...payload, created_by: userId } as any)
    .select()
    .single()

  if (error) throw new Error(error.message)
  const acopiador = data as Acopiador

  void logAudit({
    userId,
    userEmail,
    accion: 'crear',
    modulo: 'acopiadores',
    registroId: acopiador.id,
    descripcion: `Creó acopiador ${acopiador.apellido}, ${acopiador.nombre} (${acopiador.codigo})`,
    datosNuevos: acopiador as unknown as Record<string, unknown>,
  })

  return acopiador
}

export async function updateAcopiador(
  id: string,
  input: AcopiadorUpdate,
  userId = '',
  userEmail = ''
): Promise<Acopiador> {
  const { codigo: _codigo, ...payload } = input

  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  const acopiador = data as Acopiador

  void logAudit({
    userId,
    userEmail,
    accion: 'actualizar',
    modulo: 'acopiadores',
    registroId: id,
    descripcion: `Actualizó acopiador ${acopiador.apellido}, ${acopiador.nombre} (${acopiador.codigo})`,
    datosNuevos: acopiador as unknown as Record<string, unknown>,
  })

  return acopiador
}

export async function deleteAcopiador(id: string, userId = '', userEmail = ''): Promise<void> {
  let descripcion = `Eliminó acopiador (${id})`
  let datosAnteriores: Record<string, unknown> | null = null

  try {
    const { data: previo } = await supabase.from(TABLE).select('*').eq('id', id).single()
    if (previo) {
      const acopiador = previo as Acopiador
      descripcion = `Eliminó acopiador ${acopiador.apellido}, ${acopiador.nombre} (${acopiador.codigo})`
      datosAnteriores = acopiador as unknown as Record<string, unknown>
    }
  } catch {
    // Si falla el fetch previo, continuamos con la eliminación.
  }

  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)

  void logAudit({
    userId,
    userEmail,
    accion: 'eliminar',
    modulo: 'acopiadores',
    registroId: id,
    descripcion,
    datosAnteriores,
  })
}

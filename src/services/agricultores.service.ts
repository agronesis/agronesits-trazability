import { supabase } from '@/lib/supabase'
import type { Agricultor, AgricultorInsert, AgricultorUpdate } from '@/types/models'
import { logAudit } from './audit.service'

const TABLE = 'agricultores' as const
const SELECT_LISTA = `*`
const SELECT_DETALLE = `*`

export async function getAgricultores(): Promise<Agricultor[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_LISTA)
    .order('apellido', { ascending: true })

  if (error) throw new Error(error.message)
  return data as unknown as Agricultor[]
}

export async function getAgricultor(id: string): Promise<Agricultor> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_DETALLE)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as Agricultor
}

export async function createAgricultor(
  input: AgricultorInsert,
  userId: string,
  userEmail = ''
): Promise<Agricultor> {
  const { codigo: _codigo, ...payload } = input

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...payload, created_by: userId } as any)
    .select()
    .single()

  if (error) throw new Error(error.message)

  const agricultor = data as Agricultor
  void logAudit({
    userId,
    userEmail,
    accion: 'crear',
    modulo: 'agricultores',
    registroId: agricultor.id,
    descripcion: `Creó agricultor ${agricultor.apellido}, ${agricultor.nombre} (${agricultor.codigo})`,
    datosNuevos: agricultor as unknown as Record<string, unknown>,
  })

  return agricultor
}

export async function updateAgricultor(
  id: string,
  input: AgricultorUpdate,
  userId = '',
  userEmail = ''
): Promise<Agricultor> {
  const { codigo: _codigo, ...payload } = input

  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  const agricultor = data as Agricultor
  void logAudit({
    userId,
    userEmail,
    accion: 'actualizar',
    modulo: 'agricultores',
    registroId: id,
    descripcion: `Actualizó agricultor ${agricultor.apellido}, ${agricultor.nombre} (${agricultor.codigo})`,
    datosNuevos: agricultor as unknown as Record<string, unknown>,
  })

  return agricultor
}

export async function deleteAgricultor(id: string, userId = '', userEmail = ''): Promise<void> {
  // Fetch before delete to capture data for the audit log
  let descripcion = `Eliminó agricultor (${id})`
  let datosAnteriores: Record<string, unknown> | null = null
  try {
    const agri = await getAgricultor(id)
    descripcion = `Eliminó agricultor ${agri.apellido}, ${agri.nombre} (${agri.codigo})`
    datosAnteriores = agri as unknown as Record<string, unknown>
  } catch {
    // If fetch fails, proceed with deletion anyway
  }

  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)

  void logAudit({
    userId,
    userEmail,
    accion: 'eliminar',
    modulo: 'agricultores',
    registroId: id,
    descripcion,
    datosAnteriores,
  })
}

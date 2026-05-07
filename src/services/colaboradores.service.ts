import { supabase } from '@/lib/supabase'
import type { Colaborador, ColaboradorInsert, ColaboradorUpdate } from '@/types/models'
import { logAudit } from './audit.service'

const TABLE = 'colaboradores' as const

export async function getColaboradores(): Promise<Colaborador[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('apellido', { ascending: true })

  if (error) throw new Error(error.message)
  return data as Colaborador[]
}

export async function createColaborador(
  input: ColaboradorInsert,
  userId: string,
  userEmail = ''
): Promise<Colaborador> {
  const { codigo: _codigo, ...payload } = input

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...payload, created_by: userId } as any)
    .select()
    .single()

  if (error) throw new Error(error.message)
  const colaborador = data as Colaborador

  void logAudit({
    userId,
    userEmail,
    accion: 'crear',
    modulo: 'colaboradores',
    registroId: colaborador.id,
    descripcion: `Creó colaborador ${colaborador.apellido}, ${colaborador.nombre} (${colaborador.codigo})`,
    datosNuevos: colaborador as unknown as Record<string, unknown>,
  })

  return colaborador
}

export async function updateColaborador(
  id: string,
  input: ColaboradorUpdate,
  userId = '',
  userEmail = ''
): Promise<Colaborador> {
  const { codigo: _codigo, ...payload } = input

  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  const colaborador = data as Colaborador

  void logAudit({
    userId,
    userEmail,
    accion: 'actualizar',
    modulo: 'colaboradores',
    registroId: id,
    descripcion: `Actualizó colaborador ${colaborador.apellido}, ${colaborador.nombre} (${colaborador.codigo})`,
    datosNuevos: colaborador as unknown as Record<string, unknown>,
  })

  return colaborador
}

export async function deleteColaborador(id: string, userId = '', userEmail = ''): Promise<void> {
  let descripcion = `Eliminó colaborador (${id})`
  let datosAnteriores: Record<string, unknown> | null = null

  try {
    const { data: previo } = await supabase.from(TABLE).select('*').eq('id', id).single()
    if (previo) {
      const colaborador = previo as Colaborador
      descripcion = `Eliminó colaborador ${colaborador.apellido}, ${colaborador.nombre} (${colaborador.codigo})`
      datosAnteriores = colaborador as unknown as Record<string, unknown>
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
    modulo: 'colaboradores',
    registroId: id,
    descripcion,
    datosAnteriores,
  })
}
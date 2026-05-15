import { supabase } from '@/lib/supabase'
import type { Agricultor, Empaquetado, EmpaquetadoInsert, EstadoLote, Producto } from '@/types/models'
import { normalizarNumeroPallet } from '@/utils/business-rules'

const TABLE = 'empaquetados' as const

export interface EmpaquetadoOperacionRow extends Pick<Empaquetado, 'id' | 'lote_id' | 'fecha_empaquetado' | 'numero_pallet' | 'num_cajas'> {
  lote: {
    id: string
    codigo: string
    fecha_ingreso: string
    estado: EstadoLote
    codigo_lote_agricultor: string | null
    sublote: string | null
    agricultor: Pick<Agricultor, 'id' | 'nombre' | 'apellido'> | null
    producto: Pick<Producto, 'id' | 'nombre' | 'variedad'> | null
  } | null
}

export async function getEmpaquetadosPorLote(loteId: string): Promise<Empaquetado[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, colaborador:colaboradores(id, nombre, apellido)')
    .eq('lote_id', loteId)
    .order('fecha_empaquetado', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as Empaquetado[]
}

export async function getEmpaquetadosOperacion(fecha: string): Promise<EmpaquetadoOperacionRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(`
      id,
      lote_id,
      fecha_empaquetado,
      numero_pallet,
      num_cajas,
      lote:lotes(
        id,
        codigo,
        fecha_ingreso,
        estado,
        codigo_lote_agricultor,
        sublote,
        agricultor:agricultores(id, nombre, apellido),
        producto:productos(id, nombre, variedad)
      )
    `)
    .eq('fecha_empaquetado', fecha)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as EmpaquetadoOperacionRow[]
}

export async function getResumenPalletsEmpaquetado(loteId?: string): Promise<Record<string, number>> {
  let query = supabase
    .from(TABLE)
    .select('numero_pallet, num_cajas')

  if (loteId) {
    query = query.eq('lote_id', loteId)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data ?? []).reduce<Record<string, number>>((acc, row) => {
    const pallet = normalizarNumeroPallet(row.numero_pallet ?? '')
    if (!pallet) return acc
    acc[pallet] = (acc[pallet] ?? 0) + (row.num_cajas ?? 0)
    return acc
  }, {})
}

export async function createEmpaquetado(input: EmpaquetadoInsert, userId: string): Promise<Empaquetado> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Empaquetado
}

export async function deleteEmpaquetado(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
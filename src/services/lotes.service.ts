import { supabase } from '@/lib/supabase'
import type { Agricultor, Clasificacion, EstadoLote, Lote, LoteInsert, LoteUpdate, Producto } from '@/types/models'

const TABLE = 'lotes' as const
const SELECT_COMPLETO = `
  *,
  agricultor:agricultores!lotes_agricultor_id_fkey(*),
  recepcionista:colaboradores!lotes_recepcionista_id_fkey(*),
  acopiador:acopiadores(*),
  acopiador_agricultor:agricultores!lotes_acopiador_agricultor_id_fkey(*),
  producto:productos(*),
  centro_acopio:centros_acopio(*)
`

export interface LoteEmpaquetadoOperacionRow extends Pick<Lote, 'id' | 'codigo' | 'fecha_ingreso' | 'fecha_cosecha' | 'estado' | 'codigo_lote_agricultor' | 'sublote'> {
  estado: EstadoLote
  agricultor: Pick<Agricultor, 'id' | 'nombre' | 'apellido'> | null
  producto: Pick<Producto, 'id' | 'nombre' | 'variedad'> | null
  clasificaciones: Array<Pick<Clasificacion, 'id' | 'peso_bueno_kg'>> | null
  empaquetados: Array<{ num_cajas: number | null }> | null
}

export async function getLotes(): Promise<Lote[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_COMPLETO)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as unknown as Lote[]
}

export async function getLotesEmpaquetadoOperacion(fechaIngreso: string): Promise<LoteEmpaquetadoOperacionRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(`
      id,
      codigo,
      fecha_ingreso,
      fecha_cosecha,
      estado,
      codigo_lote_agricultor,
      sublote,
      agricultor:agricultores!lotes_agricultor_id_fkey(id, nombre, apellido),
      producto:productos(id, nombre, variedad),
      clasificaciones(id, peso_bueno_kg),
      empaquetados(num_cajas)
    `)
    .eq('fecha_ingreso', fechaIngreso)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as LoteEmpaquetadoOperacionRow[]
}

export async function getLote(id: string): Promise<Lote> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_COMPLETO)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as Lote
}

export async function createLote(input: LoteInsert, userId: string): Promise<Lote> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select(SELECT_COMPLETO)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as Lote
}

export async function updateLote(id: string, input: LoteUpdate): Promise<Lote> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(SELECT_COMPLETO)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as Lote
}

export async function actualizarEstadoLote(id: string, estado: Lote['estado']): Promise<Lote> {
  return updateLote(id, { estado })
}

export async function deleteLote(id: string): Promise<void> {
  // Check if there are despachos associated with this lote
  const { data: pallets, error: checkError } = await supabase
    .from('despacho_pallets')
    .select('despacho_id, despacho:despachos(codigo)')
    .eq('lote_id', id)

  if (checkError) throw new Error(checkError.message)

  if (pallets && pallets.length > 0) {
    const codigos = [...new Set(
      pallets.map((p: any) => p.despacho?.codigo).filter(Boolean)
    )]
    throw new Error(`DESPACHO_ASOCIADO::${codigos.join(', ')}`)
  }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

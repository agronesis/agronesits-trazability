import { supabase } from '@/lib/supabase'
import type { MovimientoCubeta, MovimientoCubetaInsert, BalanceCubetaAgri } from '@/types/models'
import { calcularSaldoCubetas } from '@/utils/business-rules'

const TABLE = 'movimientos_cubetas' as const

export async function getMovimientosCubetas(): Promise<MovimientoCubeta[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, agricultor:agricultores(*), lote:lotes(codigo)')
    .order('fecha', { ascending: false })

  if (error) throw new Error(error.message)
  return data as unknown as MovimientoCubeta[]
}

export async function getMovimientosPorAgricultor(agricultorId: string): Promise<MovimientoCubeta[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, lote:lotes(codigo)')
    .eq('agricultor_id', agricultorId)
    .order('fecha', { ascending: false })

  if (error) throw new Error(error.message)
  return data as unknown as MovimientoCubeta[]
}

export async function createMovimientoCubeta(
  input: MovimientoCubetaInsert,
  userId: string
): Promise<MovimientoCubeta> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select('*, agricultor:agricultores(*)')
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as MovimientoCubeta
}

export async function getBalanceCubetasPorAgricultor(agricultorId: string): Promise<BalanceCubetaAgri> {
  const movimientos = await getMovimientosPorAgricultor(agricultorId)
  const saldo = calcularSaldoCubetas(movimientos)

  return {
    agricultor_id: agricultorId,
    ...saldo,
  }
}

export async function getResumenCubetasAllAgricultores(): Promise<BalanceCubetaAgri[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('agricultor_id, tipo, cantidad, agricultor:agricultores(id, nombre, apellido, codigo)')

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{
    agricultor_id: string
    tipo: 'entrega' | 'devolucion'
    cantidad: number
  }>

  // Agrupar por agricultor
  const map = new Map<string, { movimientos: Array<{ tipo: 'entrega' | 'devolucion'; cantidad: number }> }>()

  for (const row of rows) {
    const id = row.agricultor_id
    if (!map.has(id)) map.set(id, { movimientos: [] })
    map.get(id)!.movimientos.push({ tipo: row.tipo, cantidad: row.cantidad })
  }

  return Array.from(map.entries()).map(([agricultorId, { movimientos }]) => ({
    agricultor_id: agricultorId,
    ...calcularSaldoCubetas(movimientos),
  }))
}

import { supabase } from '@/lib/supabase'

const TABLE = 'agricultor_sublotes' as const

function normalizeSublote(nombre: string): string {
  return nombre.trim().toUpperCase()
}

function uniqueSublotes(items: string[]): string[] {
  return [...new Set(items.map(normalizeSublote).filter(Boolean))]
}

export async function getAgricultorSublotes(agricultorId: string): Promise<string[]> {
  if (!agricultorId) return []

  const { data, error } = await supabase
    .from(TABLE)
    .select('nombre')
    .eq('agricultor_id', agricultorId)
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.nombre)
}

export async function replaceAgricultorSublotes(agricultorId: string, sublotes: string[], userId: string): Promise<void> {
  const values = uniqueSublotes(sublotes)

  const { error: deleteError } = await supabase
    .from(TABLE)
    .delete()
    .eq('agricultor_id', agricultorId)

  if (deleteError) throw new Error(deleteError.message)

  if (values.length === 0) return

  const payload = values.map((nombre) => ({
    agricultor_id: agricultorId,
    nombre,
    created_by: userId,
  }))

  const { error: insertError } = await supabase
    .from(TABLE)
    .insert(payload)

  if (insertError) throw new Error(insertError.message)
}

export async function ensureAgricultorSublote(agricultorId: string, sublote: string, userId: string): Promise<void> {
  const nombre = normalizeSublote(sublote)
  if (!agricultorId || !nombre) return

  const { error } = await supabase
    .from(TABLE)
    .upsert({ agricultor_id: agricultorId, nombre, created_by: userId }, {
      onConflict: 'agricultor_id,nombre',
      ignoreDuplicates: true,
    })

  if (error) throw new Error(error.message)
}

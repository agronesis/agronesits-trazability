import { supabase } from '@/lib/supabase'
import type {
  ConfigPrecio,
  ConfigPrecioInsert,
  ConfigPrecioUpdate,
  ConfigSistema,
} from '@/types/models'

const TABLE = 'config_precios' as const
const TABLE_SISTEMA = 'config_sistema' as const

export const CLAVE_PESO_CAJA_EXPORTACION = 'peso_caja_exportacion_kg' as const
export const CLAVE_PESO_CAJA_DESPACHO = 'peso_caja_despacho_kg' as const
export const CLAVE_PAGO_RECEPCION_KG = 'pago_recepcion_kg' as const
export const CLAVE_PAGO_EMPAQUETADO_CAJA = 'pago_empaquetado_caja' as const

export async function getConfigPrecios(): Promise<ConfigPrecio[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('anio', { ascending: false })
    .order('semana', { ascending: false })

  if (error) throw new Error(error.message)
  return data as ConfigPrecio[]
}

export async function createConfigPrecio(input: ConfigPrecioInsert, userId: string): Promise<ConfigPrecio> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as ConfigPrecio
}

export async function updateConfigPrecio(id: string, input: ConfigPrecioUpdate): Promise<ConfigPrecio> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as ConfigPrecio
}

export async function deleteConfigPrecio(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getConfigSistemaPorClave(clave: string): Promise<ConfigSistema | null> {
  const { data, error } = await supabase
    .from(TABLE_SISTEMA)
    .select('*')
    .eq('clave', clave)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as ConfigSistema | null
}

export async function getValorNumericoSistema(clave: string, fallback: number): Promise<number> {
  const config = await getConfigSistemaPorClave(clave)
  return Number(config?.valor_numerico ?? fallback)
}

export async function upsertConfigSistemaNumerico(
  input: Pick<ConfigSistema, 'clave' | 'nombre' | 'descripcion'> & { valor_numerico: number },
  userId: string
): Promise<ConfigSistema> {
  const { data, error } = await supabase
    .from(TABLE_SISTEMA)
    .upsert({
      ...input,
      valor_texto: null,
      created_by: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'clave' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as ConfigSistema
}

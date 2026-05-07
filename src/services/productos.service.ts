import { supabase } from '@/lib/supabase'
import type { Producto, ProductoInsert, ProductoUpdate } from '@/types/models'
import { logAudit } from './audit.service'

const TABLE = 'productos' as const

export async function getProductos(): Promise<Producto[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)
  return data as Producto[]
}

export async function getProducto(id: string): Promise<Producto> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as Producto
}

export async function createProducto(
  input: ProductoInsert,
  userId: string,
  userEmail = ''
): Promise<Producto> {
  const { codigo: _codigo, ...payload } = input
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...payload, created_by: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  const producto = data as Producto

  void logAudit({
    userId,
    userEmail,
    accion: 'crear',
    modulo: 'productos',
    registroId: producto.id,
    descripcion: `Creó producto ${producto.nombre} (${producto.codigo})`,
    datosNuevos: producto as unknown as Record<string, unknown>,
  })

  return producto
}

export async function updateProducto(
  id: string,
  input: ProductoUpdate,
  userId = '',
  userEmail = ''
): Promise<Producto> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  const producto = data as Producto

  void logAudit({
    userId,
    userEmail,
    accion: 'actualizar',
    modulo: 'productos',
    registroId: id,
    descripcion: `Actualizó producto ${producto.nombre} (${producto.codigo})`,
    datosNuevos: producto as unknown as Record<string, unknown>,
  })

  return producto
}

export async function deleteProducto(id: string, userId = '', userEmail = ''): Promise<void> {
  let descripcion = `Eliminó producto (${id})`
  let datosAnteriores: Record<string, unknown> | null = null
  try {
    const producto = await getProducto(id)
    descripcion = `Eliminó producto ${producto.nombre} (${producto.codigo})`
    datosAnteriores = producto as unknown as Record<string, unknown>
  } catch {
    // Si falla el fetch previo, continuamos con la eliminación.
  }

  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)

  void logAudit({
    userId,
    userEmail,
    accion: 'eliminar',
    modulo: 'productos',
    registroId: id,
    descripcion,
    datosAnteriores,
  })
}

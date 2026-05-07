import { useState, useEffect, useCallback } from 'react'
import { getProductos, createProducto, updateProducto, deleteProducto } from '@/services/productos.service'
import { useAuthStore } from '@/store/auth.store'
import type { Producto } from '@/types/models'
import type { ProductoFormData } from '@/utils/validators'

export function useProductos() {
  const { user } = useAuthStore()
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try { setProductos(await getProductos()) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  const crear = async (data: ProductoFormData) => {
    if (!user) throw new Error('No autenticado')
    const nuevo = await createProducto(data as Parameters<typeof createProducto>[0], user.id, user.email ?? '')
    setProductos((prev) => [nuevo, ...prev])
    return nuevo
  }

  const actualizar = async (id: string, data: ProductoFormData) => {
    const actualizado = await updateProducto(id, data, user?.id ?? '', user?.email ?? '')
    setProductos((prev) => prev.map((p) => (p.id === id ? actualizado : p)))
    return actualizado
  }

  const eliminar = async (id: string) => {
    await deleteProducto(id, user?.id ?? '', user?.email ?? '')
    setProductos((prev) => prev.filter((p) => p.id !== id))
  }

  return { productos, loading, error, reload, crear, actualizar, eliminar }
}

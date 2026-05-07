import { useState, useEffect, useCallback } from 'react'
import { getCentrosAcopio, createCentroAcopio, updateCentroAcopio, deleteCentroAcopio } from '@/services/centros-acopio.service'
import { useAuthStore } from '@/store/auth.store'
import type { CentroAcopio } from '@/types/models'
import type { CentroAcopioFormData } from '@/utils/validators'

export function useCentrosAcopio() {
  const { user } = useAuthStore()
  const [centros, setCentros] = useState<CentroAcopio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try { setCentros(await getCentrosAcopio()) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  const crear = async (data: CentroAcopioFormData) => {
    if (!user) throw new Error('No autenticado')
    const nuevo = await createCentroAcopio(data as Parameters<typeof createCentroAcopio>[0], user.id, user.email ?? '')
    setCentros((prev) => [nuevo, ...prev])
    return nuevo
  }

  const actualizar = async (id: string, data: CentroAcopioFormData) => {
    const actualizado = await updateCentroAcopio(id, data, user?.id ?? '', user?.email ?? '')
    setCentros((prev) => prev.map((c) => (c.id === id ? actualizado : c)))
    return actualizado
  }

  const eliminar = async (id: string) => {
    await deleteCentroAcopio(id, user?.id ?? '', user?.email ?? '')
    setCentros((prev) => prev.filter((c) => c.id !== id))
  }

  return { centros, loading, error, reload, crear, actualizar, eliminar }
}

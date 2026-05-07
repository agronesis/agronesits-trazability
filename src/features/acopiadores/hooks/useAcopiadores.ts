import { useState, useEffect, useCallback } from 'react'
import { getAcopiadores, createAcopiador, updateAcopiador, deleteAcopiador } from '@/services/acopiadores.service'
import { useAuthStore } from '@/store/auth.store'
import type { Acopiador } from '@/types/models'
import type { AcopiadorFormData } from '@/utils/validators'

export function useAcopiadores() {
  const { user } = useAuthStore()
  const [acopiadores, setAcopiadores] = useState<Acopiador[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAcopiadores(await getAcopiadores())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const crear = async (data: AcopiadorFormData) => {
    if (!user) throw new Error('No autenticado')
    const nuevo = await createAcopiador(data as Parameters<typeof createAcopiador>[0], user.id, user.email ?? '')
    setAcopiadores((prev) => [nuevo, ...prev])
    return nuevo
  }

  const actualizar = async (id: string, data: AcopiadorFormData) => {
    const actualizado = await updateAcopiador(id, data, user?.id ?? '', user?.email ?? '')
    setAcopiadores((prev) => prev.map((a) => (a.id === id ? actualizado : a)))
    return actualizado
  }

  const eliminar = async (id: string) => {
    await deleteAcopiador(id, user?.id ?? '', user?.email ?? '')
    setAcopiadores((prev) => prev.filter((a) => a.id !== id))
  }

  return { acopiadores, loading, error, reload, crear, actualizar, eliminar }
}

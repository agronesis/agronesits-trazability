import { useState, useEffect, useCallback } from 'react'
import { getColaboradores, createColaborador, updateColaborador, deleteColaborador } from '@/services/colaboradores.service'
import { useAuthStore } from '@/store/auth.store'
import type { Colaborador } from '@/types/models'
import type { ColaboradorFormData } from '@/utils/validators'

export function useColaboradores() {
  const { user } = useAuthStore()
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setColaboradores(await getColaboradores())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const crear = async (data: ColaboradorFormData) => {
    if (!user) throw new Error('No autenticado')
    const nuevo = await createColaborador(data as Parameters<typeof createColaborador>[0], user.id, user.email ?? '')
    setColaboradores((prev) => [nuevo, ...prev])
    return nuevo
  }

  const actualizar = async (id: string, data: ColaboradorFormData) => {
    const actualizado = await updateColaborador(id, data, user?.id ?? '', user?.email ?? '')
    setColaboradores((prev) => prev.map((c) => (c.id === id ? actualizado : c)))
    return actualizado
  }

  const eliminar = async (id: string) => {
    await deleteColaborador(id, user?.id ?? '', user?.email ?? '')
    setColaboradores((prev) => prev.filter((c) => c.id !== id))
  }

  return { colaboradores, loading, error, reload, crear, actualizar, eliminar }
}
import { useState, useEffect, useCallback } from 'react'
import {
  getAgricultores,
  createAgricultor,
  updateAgricultor,
  deleteAgricultor,
} from '@/services/agricultores.service'
import { replaceAgricultorSublotes } from '@/services/agricultor-sublotes.service'
import { useAuthStore } from '@/store/auth.store'
import type { Agricultor } from '@/types/models'
import type { AgricultorFormData } from '@/utils/validators'

export function useAgricultores() {
  const { user } = useAuthStore()
  const [agricultores, setAgricultores] = useState<Agricultor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAgricultores()
      setAgricultores(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const crear = async (data: AgricultorFormData) => {
    if (!user) throw new Error('No autenticado')
    const { sublotes = [], ...payload } = data
    const nuevo = await createAgricultor(payload as Parameters<typeof createAgricultor>[0], user.id, user.email ?? '')
    await replaceAgricultorSublotes(nuevo.id, sublotes, user.id)
    setAgricultores((prev) => [nuevo, ...prev])
    return nuevo
  }

  const actualizar = async (id: string, data: AgricultorFormData) => {
    if (!user) throw new Error('No autenticado')
    const { sublotes = [], ...payload } = data
    const actualizado = await updateAgricultor(id, payload, user.id, user.email ?? '')
    await replaceAgricultorSublotes(id, sublotes, user.id)
    setAgricultores((prev) => prev.map((a) => (a.id === id ? actualizado : a)))
    return actualizado
  }

  const eliminar = async (id: string) => {
    await deleteAgricultor(id, user?.id ?? '', user?.email ?? '')
    setAgricultores((prev) => prev.filter((a) => a.id !== id))
  }

  return { agricultores, loading, error, reload, crear, actualizar, eliminar }
}

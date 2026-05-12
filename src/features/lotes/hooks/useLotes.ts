import { useState, useEffect, useCallback } from 'react'
import { getLotes, createLote, updateLote, actualizarEstadoLote, deleteLote } from '@/services/lotes.service'
import { logAudit } from '@/services/audit.service'
import { ensureAgricultorSublote } from '@/services/agricultor-sublotes.service'
import { useAuthStore } from '@/store/auth.store'
import type { Lote, EstadoLote } from '@/types/models'
import type { LoteFormData } from '@/utils/validators'

export function useLotes() {
  const { user } = useAuthStore()
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try { setLotes(await getLotes()) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  const crear = async (data: LoteFormData) => {
    if (!user) throw new Error('No autenticado')
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { acopiador_combined: _c, ...loteData } = data as any
    const nuevo = await createLote(loteData as Parameters<typeof createLote>[0], user.id)
    if (loteData.agricultor_id && loteData.sublote) {
      await ensureAgricultorSublote(loteData.agricultor_id, loteData.sublote, user.id)
    }
    setLotes((prev) => [nuevo, ...prev])
    void logAudit({
      userId: user.id,
      userEmail: user.email ?? '',
      accion: 'crear',
      modulo: 'lotes',
      registroId: nuevo.id,
      descripcion: `Lote creado: ${nuevo.codigo}`,
      datosAnteriores: null,
      datosNuevos: { codigo: nuevo.codigo, estado: nuevo.estado },
    })
    return nuevo
  }

  const actualizar = async (id: string, data: Partial<LoteFormData>) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { acopiador_combined: _c, ...loteData } = data as any
    const actualizado = await updateLote(id, loteData as Parameters<typeof updateLote>[1])
    if (user && loteData.agricultor_id && loteData.sublote) {
      await ensureAgricultorSublote(loteData.agricultor_id, loteData.sublote, user.id)
    }
    setLotes((prev) => prev.map((l) => (l.id === id ? actualizado : l)))
    return actualizado
  }

  const cambiarEstado = async (id: string, estado: EstadoLote) => {
    const actualizado = await actualizarEstadoLote(id, estado)
    setLotes((prev) => prev.map((l) => (l.id === id ? actualizado : l)))
    return actualizado
  }

  const eliminar = async (id: string) => {
    const previo = lotes.find((l) => l.id === id)
    await deleteLote(id)
    setLotes((prev) => prev.filter((l) => l.id !== id))
    if (user && previo) {
      void logAudit({
        userId: user.id,
        userEmail: user.email ?? '',
        accion: 'eliminar',
        modulo: 'lotes',
        registroId: id,
        descripcion: `Lote eliminado: ${previo.codigo}`,
        datosAnteriores: { codigo: previo.codigo, estado: previo.estado },
        datosNuevos: null,
      })
    }
  }

  return { lotes, loading, error, reload, crear, actualizar, cambiarEstado, eliminar }
}

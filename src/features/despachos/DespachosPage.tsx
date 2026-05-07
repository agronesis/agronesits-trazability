import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Plus, Search, Trash2, Truck } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DESTINO_DESPACHO_CONFIG, ROUTES, TIPO_DESPACHO_CONFIG, VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import { getDespachos, deleteDespacho } from '@/services/despachos.service'
import { formatFecha, formatPeso } from '@/utils/formatters'
import type { Despacho } from '@/types/models'
import { useAuthStore } from '@/store/auth.store'
import { APP_PERMISSIONS, hasPermission } from '@/lib/permissions'

function resumirPorVariedad(despacho: Despacho) {
  return (despacho.pallets ?? []).reduce((acc, pallet) => {
    const variedad = pallet.lote?.producto?.variedad
    if (!variedad) return acc
    acc[variedad] += pallet.num_cajas
    return acc
  }, { snow_peas: 0, sugar: 0 })
}

export default function DespachosPage() {
  const navigate = useNavigate()
  const roles = useAuthStore((state) => state.roles)
  const [despachos, setDespachos] = useState<Despacho[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [despachoAEliminar, setDespachoAEliminar] = useState<Despacho | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const canManageDespachos = hasPermission(roles, APP_PERMISSIONS.DESPACHOS_MANAGE)

  const cargar = async () => {
    setLoading(true)
    try {
      setDespachos(await getDespachos())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const handleEliminar = async () => {
    if (!despachoAEliminar) return
    setEliminando(true)
    try {
      await deleteDespacho(despachoAEliminar.id)
      setDespachos((prev) => prev.filter((d) => d.id !== despachoAEliminar.id))
      setDespachoAEliminar(null)
    } catch (e) {
      setDespachoAEliminar(null)
      setError((e as Error).message)
    } finally {
      setEliminando(false)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />

  const filtrados = despachos.filter((despacho) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return despacho.codigo.toLowerCase().includes(q)
      || despacho.exportador?.toLowerCase().includes(q)
      || despacho.marca_caja?.toLowerCase().includes(q)
      || despacho.transportista?.toLowerCase().includes(q)
      || despacho.placa_vehiculo?.toLowerCase().includes(q)
      || despacho.fecha_despacho.includes(q)
  })

  return (
    <div>
      <PageHeader
        title="Despachos"
        description="Registro operativo de despachos a partir de pallets empaquetados."
        actions={canManageDespachos ? (
          <Button onClick={() => navigate(ROUTES.DESPACHOS_NUEVO)}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo despacho
          </Button>
        ) : undefined}
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por codigo, exportador, marca, proveedor, placa o fecha..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {filtrados.length === 0 ? (
        <EmptyState icon={<Truck className="h-8 w-8" />} title="Sin despachos" description="Registra el primer despacho seleccionando pallets empaquetados." />
      ) : (
        <div className="flex flex-col gap-3">
          {filtrados.map((despacho) => {
            const resumen = resumirPorVariedad(despacho)
            return (
              <Card key={despacho.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/despachos/${despacho.id}`)}>
                <CardContent className="pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm">{despacho.codigo}</p>
                      <span className="text-xs text-muted-foreground">{formatFecha(despacho.fecha_despacho)}</span>
                      <span className="text-xs rounded-full bg-muted px-2 py-0.5">{DESTINO_DESPACHO_CONFIG[despacho.destino].label}</span>
                      <span className="text-xs rounded-full bg-muted px-2 py-0.5">{TIPO_DESPACHO_CONFIG[despacho.tipo_despacho].label}</span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">
                      {despacho.exportador || 'Sin exportador'} · {despacho.marca_caja || 'Sin marca de caja'}
                    </p>
                    <p className="text-xs mt-2 text-muted-foreground">
                      {VARIEDAD_PRODUCTO_CONFIG.snow_peas.label}: <strong className="text-foreground">{resumen.snow_peas}</strong> cajas · {VARIEDAD_PRODUCTO_CONFIG.sugar.label}: <strong className="text-foreground">{resumen.sugar}</strong> cajas
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="font-bold text-sm">{despacho.num_cajas_despachadas} cajas</p>
                    <p className="text-xs text-muted-foreground">{formatPeso(despacho.peso_neto_kg)} · {(despacho.pallets ?? []).length} pallet(es)</p>
                    {(despacho.transportista || despacho.placa_vehiculo) && (
                      <p className="text-xs text-muted-foreground mt-1">{despacho.transportista || '-'}{despacho.placa_vehiculo ? ` · ${despacho.placa_vehiculo}` : ''}</p>
                    )}
                    {canManageDespachos && (
                      <div className="mt-2">
                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDespachoAEliminar(despacho)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/despachos/${despacho.id}/editar`)
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {canManageDespachos && (
        <ConfirmDialog
          open={Boolean(despachoAEliminar)}
          title="Eliminar despacho"
          description={`¿Está seguro que desea eliminar el despacho ${despachoAEliminar?.codigo ?? ''}? Se eliminarán también los pallets asociados. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="destructive"
          loading={eliminando}
          onConfirm={handleEliminar}
          onCancel={() => setDespachoAEliminar(null)}
        />
      )}
    </div>
  )
}
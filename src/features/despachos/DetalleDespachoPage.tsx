import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorMessage } from '@/components/shared/ErrorMessage'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPage } from '@/components/shared/Spinner'
import { DESTINO_DESPACHO_CONFIG, ROUTES, TIPO_DESPACHO_CONFIG, VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import { getDespacho, getPackingListData, getAnexo41Data } from '@/services/despachos.service'
import { generatePackingListExcel } from '@/utils/packing-list-excel'
import { generateAnexo41Excel } from '@/utils/anexo41-excel'
import { formatFecha, formatPeso } from '@/utils/formatters'
import type { Despacho } from '@/types/models'
import { useAuthStore } from '@/store/auth.store'
import { APP_PERMISSIONS, hasPermission } from '@/lib/permissions'

export default function DetalleDespachoPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const roles = useAuthStore((state) => state.roles)
  const [despacho, setDespacho] = useState<Despacho | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [descargando, setDescargando] = useState(false)
  const [descargandoAnexo, setDescargandoAnexo] = useState(false)

  const cargar = async () => {
    if (!id) return
    setLoading(true)
    try {
      setDespacho(await getDespacho(id))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  const descargarPackingList = async () => {
    if (!id) return
    setDescargando(true)
    try {
      const data = await getPackingListData(id)
      generatePackingListExcel(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDescargando(false)
    }
  }

  const descargarAnexo41 = async () => {
    if (!id) return
    setDescargandoAnexo(true)
    try {
      const data = await getAnexo41Data(id)
      generateAnexo41Excel(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDescargandoAnexo(false)
    }
  }

  const resumenVariedad = useMemo(() => (despacho?.pallets ?? []).reduce((acc, pallet) => {
    const variedad = pallet.lote?.producto?.variedad
    if (!variedad) return acc
    acc[variedad] += pallet.num_cajas
    return acc
  }, { snow_peas: 0, sugar: 0 }), [despacho])

  if (loading) return <LoadingPage />
  if (error) return <ErrorMessage message={error} onRetry={cargar} />
  if (!despacho) return null

  const canManageDespachos = hasPermission(roles, APP_PERMISSIONS.DESPACHOS_MANAGE)

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4">
      <PageHeader
        title={despacho.codigo}
        description={`${formatFecha(despacho.fecha_despacho)} · ${DESTINO_DESPACHO_CONFIG[despacho.destino].label} · ${TIPO_DESPACHO_CONFIG[despacho.tipo_despacho].label}`}
        backHref={ROUTES.DESPACHOS}
        actions={
          id ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={descargarAnexo41} disabled={descargandoAnexo}>
                <Download className="h-4 w-4 mr-2" /> {descargandoAnexo ? 'Generando…' : 'Anexo 4.1'}
              </Button>
              <Button variant="outline" onClick={descargarPackingList} disabled={descargando}>
                <Download className="h-4 w-4 mr-2" /> {descargando ? 'Generando…' : 'Packing List'}
              </Button>
              {canManageDespachos && (
                <Button onClick={() => navigate(`/despachos/${id}/editar`)}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar despacho
                </Button>
              )}
            </div>
          ) : null
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">Pallets</p><p className="font-bold text-lg">{(despacho.pallets ?? []).length}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">Cajas</p><p className="font-bold text-lg">{despacho.num_cajas_despachadas}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">Peso neto</p><p className="font-bold text-lg">{formatPeso(despacho.peso_neto_kg)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">Snow Peas</p><p className="font-bold text-lg">{resumenVariedad.snow_peas}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">Sugar Snap</p><p className="font-bold text-lg">{resumenVariedad.sugar}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Datos generales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-muted-foreground">Codigo</p><p className="font-medium">{despacho.codigo}</p></div>
          <div><p className="text-xs text-muted-foreground">Fecha despacho</p><p className="font-medium">{formatFecha(despacho.fecha_despacho)}</p></div>
          <div><p className="text-xs text-muted-foreground">Exportador</p><p className="font-medium">{despacho.exportador || '-'}</p></div>
          <div><p className="text-xs text-muted-foreground">Marca de caja</p><p className="font-medium">{despacho.marca_caja || '-'}</p></div>
          <div><p className="text-xs text-muted-foreground">Proveedor de transporte</p><p className="font-medium">{despacho.transportista || '-'}</p></div>
          <div><p className="text-xs text-muted-foreground">Placa</p><p className="font-medium">{despacho.placa_vehiculo || '-'}</p></div>
          <div className="md:col-span-2"><p className="text-xs text-muted-foreground">Observaciones</p><p className="font-medium">{despacho.observaciones || '-'}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pallets del despacho</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(despacho.pallets ?? []).map((pallet) => (
            <div key={pallet.id} className="rounded-lg border px-3 py-3 text-sm flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Pallet {pallet.numero_pallet} · {pallet.lote?.codigo || 'Sin lote'}</p>
                <p className="text-xs text-muted-foreground">
                  {pallet.lote?.producto?.variedad ? VARIEDAD_PRODUCTO_CONFIG[pallet.lote.producto.variedad].label : '-'} · {pallet.lote?.producto?.nombre || '-'}
                </p>
              </div>
              <p className="font-semibold">{pallet.num_cajas} cajas</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}